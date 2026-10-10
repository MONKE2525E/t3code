import {
  GrokBot,
  GrokBotId,
  GrokBotConversation,
  GrokBotError,
  GrokBotStatus,
  GrokBotUpdateInput,
  GrokBotSendInput,
  GrokBotLinkInput,
  GrokBotPullRequest,
  type PullRequestRef,
} from "@t3tools/contracts";
import { defaultGrokBotAvatarColor, defaultGrokBotAvatarShape } from "./defaultAvatar.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as ProcessRunner from "../processRunner.ts";
import * as ServerConfig from "../config.ts";
import * as PullRequestService from "../pullRequest/PullRequestService.ts";

const Preferences = Schema.Record(
  Schema.String,
  Schema.Struct({
    pinned: Schema.Boolean,
    featured: Schema.Boolean,
    pullRequests: Schema.Array(GrokBotPullRequest),
  }),
);
type Preferences = typeof Preferences.Type;
const RawBot = Schema.Struct({
  id: GrokBotId,
  name: Schema.String,
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  avatarShape: Schema.optionalKey(Schema.String),
  avatarColor: Schema.optionalKey(Schema.String),
  notifyOnAgentUpdates: Schema.optionalKey(Schema.Boolean),
  hiddenFromSidebar: Schema.optionalKey(Schema.Boolean),
});
const Transcript = Schema.Struct({
  transcript: Schema.Struct({ entries: Schema.Array(Schema.Unknown) }),
});
const Receipt = Schema.Struct({ delivery: Schema.String, exitCode: Schema.Number });
const isGrokBotError = Schema.is(GrokBotError);
const decodePreferences = Schema.decodeEffect(Schema.fromJsonString(Preferences));
const encodePreferences = Schema.encodeEffect(Schema.fromJsonString(Preferences));
const decodeRoster = Schema.decodeEffect(Schema.fromJsonString(Schema.Array(RawBot)));
const decodeTranscript = Schema.decodeEffect(Schema.fromJsonString(Transcript));
const decodeReceipt = Schema.decodeEffect(Schema.fromJsonString(Receipt));

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Only user messages and bot replies belong in chat; tool events remain on Grok's computer. */
function messagesFrom(entries: readonly unknown[]) {
  return entries.flatMap((value) => {
    const entry = record(value);
    if (entry === undefined || typeof entry.id !== "string") return [];
    const message = record(entry.message);
    const text =
      entry.kind === "send-message" && message?.type === "text"
        ? message.content
        : entry.kind === "message" && entry.role === "user"
          ? entry.content
          : undefined;
    if (typeof text !== "string") return [];
    return [
      {
        id: entry.id,
        role: entry.kind === "send-message" ? ("assistant" as const) : ("user" as const),
        text,
        timestampMs:
          typeof entry.timestampMs === "number" && Number.isFinite(entry.timestampMs)
            ? entry.timestampMs
            : 0,
        streaming: entry.isStreaming === true,
      },
    ];
  });
}

function linkKey(reference: PullRequestRef): string {
  return [reference.projectId, reference.host ?? "", reference.repository, reference.number].join(
    "\u0000",
  );
}

export class GrokBotService extends Context.Service<
  GrokBotService,
  {
    readonly status: Effect.Effect<typeof GrokBotStatus.Type, GrokBotError>;
    readonly setup: Effect.Effect<typeof GrokBotStatus.Type, GrokBotError>;
    readonly list: Effect.Effect<readonly GrokBot[], GrokBotError>;
    readonly read: (botId: string) => Effect.Effect<typeof GrokBotConversation.Type, GrokBotError>;
    readonly send: (
      input: typeof GrokBotSendInput.Type,
    ) => Effect.Effect<{ readonly accepted: boolean }, GrokBotError>;
    readonly update: (
      input: typeof GrokBotUpdateInput.Type,
    ) => Effect.Effect<GrokBot, GrokBotError>;
    readonly link: (input: typeof GrokBotLinkInput.Type) => Effect.Effect<GrokBot, GrokBotError>;
  }
>()("t3/grokBot/GrokBotService") {}

const make = Effect.gen(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig.ServerConfig;
  const prs = yield* PullRequestService.PullRequestService;
  const home = yield* HostProcess.HomeDirectory;
  const env = yield* HostProcess.Environment;
  const executable = yield* HostProcess.ExecutablePath;
  const isExecutable = yield* HostProcess.IsExecutable;
  const platform = yield* HostProcess.Platform;
  const lock = yield* Semaphore.make(1);
  const installLock = yield* Semaphore.make(1);
  const root = path.join(config.baseDir, "integrations", "grokbot");
  const managedCli = path.join(root, "node_modules", "grok-bot-cli", "dist", "bin", "gbot.mjs");
  const preferencesPath = path.join(config.stateDir, "grok-bots.json");
  const appData =
    platform === "win32"
      ? path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Grok Bot")
      : platform === "darwin"
        ? path.join(home, "Library", "Application Support", "Grok Bot")
        : path.join(env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "Grok Bot");
  const storageError = () => new GrokBotError({ reason: "storage_failed" });
  const invalidResponse = () => new GrokBotError({ reason: "invalid_response" });
  const load = Effect.gen(function* () {
    if (!(yield* fs.exists(preferencesPath))) return {} as Preferences;
    return yield* decodePreferences(yield* fs.readFileString(preferencesPath));
  }).pipe(Effect.mapError(storageError));
  const save = (preferences: Preferences) =>
    Effect.gen(function* () {
      yield* fs.makeDirectory(path.dirname(preferencesPath), { recursive: true });
      const temp = `${preferencesPath}.tmp`;
      const encoded = yield* encodePreferences(preferences);
      yield* fs.writeFileString(temp, encoded, { mode: 0o600 });
      yield* fs.rename(temp, preferencesPath);
    }).pipe(Effect.mapError(storageError));
  const invocation = Effect.gen(function* () {
    return (yield* fs.exists(managedCli))
      ? {
          command: isExecutable ? "node" : executable,
          prefix: [managedCli],
          env: { ...env, ELECTRON_RUN_AS_NODE: "1", CODEX_THREAD_ID: "" },
        }
      : { command: "gbot", prefix: [] as string[], env: { ...env, CODEX_THREAD_ID: "" } };
  }).pipe(Effect.mapError(() => new GrokBotError({ reason: "cli_unavailable" })));
  const status = Effect.gen(function* () {
    const managed = yield* fs.exists(managedCli);
    const sessionPresent = yield* fs.exists(path.join(appData, "gateway-descriptor.json"));
    const command = yield* invocation;
    const installed = yield* runner
      .run({
        ...command,
        args: [...command.prefix, "--version"],
        timeout: "5 seconds",
        maxOutputBytes: 4096,
      })
      .pipe(
        Effect.map((result) => result.code === 0),
        Effect.orElseSucceed(() => false),
      );
    return { installed, managed, sessionPresent };
  }).pipe(Effect.mapError(() => new GrokBotError({ reason: "cli_unavailable" })));
  const cli = (args: readonly string[], sending = false) =>
    Effect.gen(function* () {
      if (!(yield* fs.exists(path.join(appData, "gateway-descriptor.json"))))
        return yield* new GrokBotError({ reason: "signed_out" });
      const command = yield* invocation;
      const result = yield* runner
        .run({
          command: command.command,
          env: command.env,
          args: [...command.prefix, ...args],
          timeout: "45 seconds",
          maxOutputBytes: 2 * 1024 * 1024,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new GrokBotError({
                reason:
                  error._tag === "ProcessSpawnError"
                    ? "cli_unavailable"
                    : sending
                      ? "delivery_unknown"
                      : "gateway_failed",
              }),
          ),
        );
      if (result.code !== 0)
        return yield* new GrokBotError({ reason: sending ? "delivery_unknown" : "gateway_failed" });
      return result.stdout;
    }).pipe(
      Effect.mapError((error) =>
        isGrokBotError(error) ? error : new GrokBotError({ reason: "gateway_failed" }),
      ),
    );
  const rawList = cli(["bots", "list", "--gateway", "--json"]).pipe(
    Effect.flatMap((text) => decodeRoster(text).pipe(Effect.mapError(invalidResponse))),
  );
  const decorate = (bot: typeof RawBot.Type, preferences: Preferences): GrokBot => ({
    id: bot.id,
    name: bot.name,
    label: bot.title ?? "",
    description: bot.description ?? "",
    avatarShape: bot.avatarShape ?? defaultGrokBotAvatarShape(bot.id),
    avatarColor: bot.avatarColor ?? defaultGrokBotAvatarColor(bot.id),
    notificationEnabled: bot.notifyOnAgentUpdates ?? true,
    hidden: bot.hiddenFromSidebar ?? false,
    pinned: preferences[bot.id]?.pinned ?? true,
    featured: preferences[bot.id]?.featured ?? false,
    pullRequests: preferences[bot.id]?.pullRequests ?? [],
  });
  // Preserve failed host reads. Only a confirmed merge removes a link, never the remote bot.
  const reconcile = lock.withPermits(1)(
    Effect.gen(function* () {
      const preferences = { ...(yield* load) };
      let changed = false;
      for (const [id, preference] of Object.entries(preferences)) {
        const links = yield* Effect.forEach(
          preference.pullRequests,
          (link) =>
            prs.summary({ ...link.reference, allowStale: false }).pipe(
              Effect.map((summary) =>
                summary.state === "merged"
                  ? null
                  : {
                      ...link,
                      title: summary.title,
                      url: summary.url,
                      state: summary.state,
                    },
              ),
              Effect.orElseSucceed(() => link),
            ),
          { concurrency: 4 },
        );
        const remaining = links.filter((link) => link !== null);
        if (
          remaining.length !== preference.pullRequests.length ||
          remaining.some((link, index) => {
            const previous = preference.pullRequests[index];
            return (
              previous?.title !== link.title ||
              previous.url !== link.url ||
              previous.state !== link.state
            );
          })
        ) {
          preferences[id] = { ...preference, pullRequests: remaining };
          changed = true;
        }
      }
      if (changed) yield* save(preferences);
      return preferences;
    }),
  );
  const list = Effect.gen(function* () {
    const bots = yield* rawList;
    const preferences = yield* reconcile;
    return bots.map((bot) => decorate(bot, preferences));
  });
  const find = (botId: string) =>
    list.pipe(
      Effect.flatMap((bots) => {
        const bot = bots.find((candidate) => candidate.id === botId);
        return bot === undefined
          ? Effect.fail(new GrokBotError({ reason: "bot_not_found" }))
          : Effect.succeed(bot);
      }),
    );
  const read = (botId: string) =>
    Effect.gen(function* () {
      const bot = yield* find(botId);
      const text = yield* cli([
        "thread",
        "--gateway",
        "--json",
        "--no-history",
        "--limit",
        "200",
        "--",
        botId,
      ]);
      const transcript = yield* decodeTranscript(text).pipe(Effect.mapError(invalidResponse));
      return { bot, messages: messagesFrom(transcript.transcript.entries) };
    });
  const send = (input: typeof GrokBotSendInput.Type) =>
    Effect.gen(function* () {
      yield* find(input.botId);
      const text = yield* cli(
        [
          "send",
          "--gateway",
          "--json",
          "--no-history",
          "--reply-mode",
          "manual",
          "--",
          input.botId,
          input.message,
        ],
        true,
      );
      const receipt = yield* decodeReceipt(text).pipe(
        Effect.mapError(() => new GrokBotError({ reason: "delivery_unknown" })),
      );
      if (receipt.delivery !== "accepted" || receipt.exitCode !== 0)
        return yield* new GrokBotError({ reason: "delivery_unknown" });
      return { accepted: true };
    });
  const update = (input: typeof GrokBotUpdateInput.Type) =>
    Effect.gen(function* () {
      yield* find(input.botId);
      const args = ["bots", "update", "--gateway", "--json"];
      if (input.name !== undefined) args.push("--name", input.name);
      if (input.label !== undefined) args.push("--title", input.label);
      if (input.description !== undefined) args.push("--description", input.description);
      if (input.notificationEnabled !== undefined)
        args.push("--notify", input.notificationEnabled ? "on" : "off");
      if (input.hidden !== undefined) args.push("--hidden", input.hidden ? "on" : "off");
      if (args.length > 5) yield* cli([...args, "--", input.botId]);
      if (input.pinned !== undefined || input.featured !== undefined)
        yield* lock.withPermits(1)(
          Effect.gen(function* () {
            const preferences = { ...(yield* load) };
            const current = preferences[input.botId] ?? {
              pinned: true,
              featured: false,
              pullRequests: [],
            };
            preferences[input.botId] = {
              ...current,
              pinned: input.pinned ?? current.pinned,
              featured: input.featured ?? current.featured,
            };
            yield* save(preferences);
          }),
        );
      return yield* find(input.botId);
    });
  const link = (input: typeof GrokBotLinkInput.Type) =>
    Effect.gen(function* () {
      yield* find(input.botId);
      const summary = input.remove
        ? undefined
        : yield* prs
            .summary({ ...input.reference, allowStale: false })
            .pipe(Effect.mapError(() => new GrokBotError({ reason: "pr_failed" })));
      yield* lock.withPermits(1)(
        Effect.gen(function* () {
          const preferences = { ...(yield* load) };
          const current = preferences[input.botId] ?? {
            pinned: true,
            featured: false,
            pullRequests: [],
          };
          const links = current.pullRequests.filter(
            (entry) => linkKey(entry.reference) !== linkKey(input.reference),
          );
          if (summary !== undefined && summary.state !== "merged")
            links.push({
              reference: input.reference,
              url: summary.url,
              title: summary.title,
              state: summary.state,
            });
          preferences[input.botId] = { ...current, pullRequests: links };
          yield* save(preferences);
        }),
      );
      return yield* find(input.botId);
    });
  const setup = installLock.withPermits(1)(
    Effect.gen(function* () {
      if (yield* fs.exists(managedCli)) return yield* status;
      const result = yield* runner
        .run({
          command: "npm",
          args: [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--prefix",
            root,
            "grok-bot-cli@0.12.4",
          ],
          timeout: "120 seconds",
          maxOutputBytes: 65536,
        })
        .pipe(Effect.mapError(() => new GrokBotError({ reason: "setup_failed" })));
      if (result.code !== 0) return yield* new GrokBotError({ reason: "setup_failed" });
      return yield* status;
    }).pipe(
      Effect.mapError((error) =>
        isGrokBotError(error) ? error : new GrokBotError({ reason: "setup_failed" }),
      ),
    ),
  );
  return GrokBotService.of({ status, setup, list, read, send, update, link });
});

export const layer = Layer.effect(GrokBotService, make);
