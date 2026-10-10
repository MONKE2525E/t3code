import { assert, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ProjectId, PullRequestOperationError, type PullRequestSummary } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as ServerConfig from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as PullRequestService from "../pullRequest/PullRequestService.ts";
import * as GrokBotService from "./GrokBotService.ts";

const bot = {
  id: "bot-1",
  name: "Test bot",
  title: "Builder",
  avatarShape: "blob",
  avatarColor: "green",
};
const reference = {
  projectId: ProjectId.make("project-1"),
  repository: "example/repo",
  number: 12,
};
const summary = (state: PullRequestSummary["state"]): PullRequestSummary => ({
  ...reference,
  provider: "github",
  title: "Example change",
  url: "https://github.com/example/repo/pull/12",
  state,
  headBranch: "feature",
  baseBranch: "main",
  updatedAt: "2026-10-09T00:00:00Z",
});
const output = (stdout: string, code = 0): ProcessRunner.ProcessRunOutput => ({
  stdout,
  stderr: "",
  code: ChildProcessSpawner.ExitCode(code),
  timedOut: false,
  stdoutTruncated: false,
  stderrTruncated: false,
  stdoutInvalidUtf8: false,
  stderrInvalidUtf8: false,
});

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "t3-grokbot-test-" });
  const descriptor = `${root}/.config/Grok Bot/gateway-descriptor.json`;
  yield* fs.makeDirectory(`${root}/.config/Grok Bot`, { recursive: true });
  yield* fs.writeFileString(descriptor, "encrypted-session-fixture");
  const calls: ProcessRunner.ProcessRunInput[] = [];
  const remote = {
    bots: [bot],
    transcript: { entries: [] as unknown[] },
    receipt: { delivery: "accepted", exitCode: 0 },
    sendCode: 0,
    prState: "open" as PullRequestSummary["state"],
    heldPrState: null as PullRequestSummary["state"] | null,
    failPr: false,
  };
  const run = (input: ProcessRunner.ProcessRunInput) =>
    Effect.sync(() => {
      calls.push(input);
      if (input.args.includes("list")) return output(JSON.stringify(remote.bots));
      if (input.args.includes("thread"))
        return output(JSON.stringify({ transcript: remote.transcript }));
      if (input.args.includes("send"))
        return output(JSON.stringify(remote.receipt), remote.sendCode);
      return output("0.12.4");
    });
  const serviceLayer = GrokBotService.layer.pipe(
    Layer.provide(Layer.mock(ProcessRunner.ProcessRunner)({ run })),
    Layer.provide(
      Layer.mock(PullRequestService.PullRequestService)({
        summary: (input) =>
          remote.failPr
            ? Effect.fail(
                new PullRequestOperationError({ operation: "summary", detail: "Host unavailable" }),
              )
            : Effect.succeed(
                summary(
                  input.allowStale !== false && remote.heldPrState !== null
                    ? remote.heldPrState
                    : remote.prState,
                ),
              ),
      }),
    ),
    Layer.provide(ServerConfig.layerTest(root, root)),
    Layer.provide(Layer.succeed(HostProcess.HomeDirectory, root)),
    Layer.provide(Layer.succeed(HostProcess.Platform, "linux")),
    Layer.provide(Layer.succeed(HostProcess.Environment, {})),
  );
  const service = Context.get(yield* Layer.build(serviceLayer), GrokBotService.GrokBotService);
  return { root, fs, descriptor, calls, remote, service, serviceLayer };
});

it.layer(NodeServices.layer)("Grok Bot bridge", (it) => {
  it.effect("normalizes real roster and includes only chat messages from history", () =>
    Effect.gen(function* () {
      const { service, remote, calls } = yield* fixture;
      remote.transcript.entries = [
        { id: "u1", kind: "message", role: "user", content: "hello", timestampMs: 5 },
        {
          id: "a1",
          kind: "send-message",
          message: { type: "text", content: "hi" },
          timestampMs: 6,
        },
        { id: "tool", kind: "event", content: "private tool details" },
        { id: "widget", kind: "send-message", message: { type: "widget", content: "screen" } },
      ];
      const conversation = yield* service.read(bot.id);
      assert.strictEqual(conversation.bot.label, "Builder");
      assert.strictEqual(conversation.bot.pinned, true);
      assert.deepStrictEqual(
        conversation.messages.map((entry) => [entry.role, entry.text]),
        [
          ["user", "hello"],
          ["assistant", "hi"],
        ],
      );
      assert.deepStrictEqual(calls.at(-1)?.args.slice(-2), ["--", bot.id]);
    }),
  );
  it.effect("preserves local preferences across concurrent writes and a restart", () =>
    Effect.gen(function* () {
      const { service, serviceLayer } = yield* fixture;
      yield* Effect.all(
        [
          service.update({ botId: bot.id, pinned: false }),
          service.update({ botId: bot.id, featured: true }),
        ],
        { concurrency: "unbounded" },
      );
      const restarted = Context.get(
        yield* Layer.build(serviceLayer),
        GrokBotService.GrokBotService,
      );
      const [saved] = yield* restarted.list;
      assert.strictEqual(saved?.pinned, false);
      assert.strictEqual(saved?.featured, true);
      assert.strictEqual(saved?.name, bot.name);
    }),
  );
  it.effect("removes only a merged PR association while retaining the pinned bot", () =>
    Effect.gen(function* () {
      const { service, remote } = yield* fixture;
      const linked = yield* service.link({ botId: bot.id, reference });
      assert.strictEqual(linked.pullRequests.length, 1);
      remote.heldPrState = "open";
      remote.failPr = true;
      assert.strictEqual((yield* service.list)[0]?.pullRequests.length, 1);
      remote.failPr = false;
      remote.prState = "closed";
      assert.strictEqual((yield* service.list)[0]?.pullRequests[0]?.state, "closed");
      remote.prState = "merged";
      const [remaining] = yield* service.list;
      assert.strictEqual(remaining?.id, bot.id);
      assert.strictEqual(remaining?.pinned, true);
      assert.deepStrictEqual(remaining?.pullRequests, []);
    }),
  );
  it.effect("does not repeat a send when its receipt reports uncertain delivery", () =>
    Effect.gen(function* () {
      const { service, remote, calls } = yield* fixture;
      remote.receipt.delivery = "unknown";
      const error = yield* service
        .send({ botId: bot.id, message: "one message" })
        .pipe(Effect.flip);
      assert.strictEqual(error.reason, "delivery_unknown");
      assert.strictEqual(calls.filter((call) => call.args.includes("send")).length, 1);
      assert.strictEqual(calls.at(-1)?.env?.CODEX_THREAD_ID, "");
    }),
  );
  it.effect("rejects unsigned sessions before invoking the CLI", () =>
    Effect.gen(function* () {
      const { service, fs, descriptor, calls } = yield* fixture;
      yield* fs.remove(descriptor);
      const error = yield* service.list.pipe(Effect.flip);
      assert.strictEqual(error.reason, "signed_out");
      assert.deepStrictEqual(calls, []);
    }),
  );
});
