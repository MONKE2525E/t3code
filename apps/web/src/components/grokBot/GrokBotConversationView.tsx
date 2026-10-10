import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { GrokBotConversation, type EnvironmentId, type GrokBot } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpIcon, InfoIcon, SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { ComposerSurface } from "~/components/chat/ComposerSurface";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { useProjects } from "~/state/entities";
import { grokBotsReadQuery, grokBotsSend } from "~/state/grokBots";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotAvatar } from "./GrokBotAvatar";
import { getGrokBotActivity, setGrokBotActivity, useGrokBotActivity } from "./grokBotActivity";
import { GrokBotLimitations } from "./GrokBotLimitations";
import { GrokBotProfileEditor } from "./GrokBotProfileEditor";
import {
  grokBotFailureMessage,
  grokBotSettingsDestinationSearch,
  grokBotSurfaceKey,
} from "./grokBotPresentation";

const FINISHED_REACTION_MS = 2800;
const CELEBRATE_REACTION_MS = 3600;
const FAILED_REACTION_MS = 3200;
/** Longest a sent message waits on the bot before it goes back to rest. */
const THINKING_TIMEOUT_MS = 90_000;

export function GrokBotConversationView({
  environmentId,
  botId,
}: {
  readonly environmentId: EnvironmentId;
  readonly botId: string;
}) {
  const conversation = useEnvironmentQuery(grokBotsReadQuery({ environmentId, input: { botId } }));
  const projects = useProjects().filter((project) => project.environmentId === environmentId);
  const [profileOpen, setProfileOpen] = useState(false);
  const bot = conversation.data?.bot ?? null;
  const messages = conversation.data?.messages ?? [];
  const surfaceKey = grokBotSurfaceKey(environmentId, botId);
  const loading = conversation.isPending && conversation.data === null;
  const streaming = messages.at(-1)?.streaming === true;
  const wasStreaming = useRef(false);
  const linkedPullRequests = bot?.pullRequests.length ?? null;
  const previousPullRequests = useRef(linkedPullRequests);

  // The bot rests unless something is happening, so each phase of a chat sets
  // the activity the avatar plays; one-shot reactions clear themselves.
  useEffect(() => {
    if (loading) setGrokBotActivity(surfaceKey, "loading");
    else if (getGrokBotActivity(surfaceKey) === "loading") setGrokBotActivity(surfaceKey, null);
  }, [loading, surfaceKey]);
  useEffect(() => {
    if (streaming) {
      setGrokBotActivity(surfaceKey, "streaming");
    } else if (wasStreaming.current) {
      setGrokBotActivity(surfaceKey, "finished", FINISHED_REACTION_MS);
    }
    wasStreaming.current = streaming;
  }, [streaming, surfaceKey]);
  // A merged pull request drops off the bot's list.
  useEffect(() => {
    const previous = previousPullRequests.current;
    previousPullRequests.current = linkedPullRequests;
    if (previous !== null && linkedPullRequests !== null && linkedPullRequests < previous) {
      setGrokBotActivity(surfaceKey, "celebrate", CELEBRATE_REACTION_MS);
    }
  }, [linkedPullRequests, surfaceKey]);
  // Leaving the chat ends what only this view could observe; a pending
  // "thinking" survives so the sidebar keeps showing the bot at work.
  useEffect(
    () => () => {
      const current = getGrokBotActivity(surfaceKey);
      if (current === "loading" || current === "streaming") setGrokBotActivity(surfaceKey, null);
    },
    [surfaceKey],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" tone="muted" />
      </div>
    );
  }

  if (conversation.error && conversation.data === null) {
    return (
      <Empty size="hero">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SettingsIcon />
          </EmptyMedia>
          <EmptyTitle>Could not load this bot</EmptyTitle>
          <EmptyDescription>{conversation.error}</EmptyDescription>
        </EmptyHeader>
        <Button size="sm" variant="outline" onClick={() => conversation.refresh()}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (bot === null) {
    return (
      <Empty size="hero">
        <EmptyHeader>
          <EmptyTitle>Bot not found</EmptyTitle>
          <EmptyDescription>This bot is no longer in your Grok Bot account.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <GrokBotConversationHeader
          bot={bot}
          environmentId={environmentId}
          profileOpen={profileOpen}
          onToggleProfile={() => setProfileOpen((open) => !open)}
        />
        {conversation.error ? (
          <p className="px-4 py-2 text-sm text-destructive-foreground">{conversation.error}</p>
        ) : null}
        <GrokBotMessageList
          key={`messages:${surfaceKey}`}
          bot={bot}
          messages={messages}
          environmentId={environmentId}
        />
        <GrokBotComposer key={`composer:${surfaceKey}`} environmentId={environmentId} bot={bot} />
      </section>
      {profileOpen ? (
        <aside className="min-h-0 w-[22rem] shrink-0 overflow-y-auto border-l border-border/60 px-4 py-5 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:bg-background">
          <GrokBotProfileEditor
            key={`profile:${surfaceKey}`}
            environmentId={environmentId}
            bot={bot}
            projects={projects}
          />
          <GrokBotLimitations className="mt-6" />
        </aside>
      ) : null}
    </div>
  );
}

function GrokBotConversationHeader({
  bot,
  environmentId,
  profileOpen,
  onToggleProfile,
}: {
  readonly bot: GrokBot;
  readonly environmentId: EnvironmentId;
  readonly profileOpen: boolean;
  readonly onToggleProfile: () => void;
}) {
  const navigate = useNavigate();
  const activity = useGrokBotActivity(grokBotSurfaceKey(environmentId, bot.id));
  return (
    <header className="flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 border-b border-border/50 px-4">
      <GrokBotAvatar bot={bot} size="sm" featured={bot.featured} state={activity} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium">{bot.name}</h1>
        {bot.label.trim().length > 0 ? (
          <p className="truncate text-xs text-muted-foreground">{bot.label}</p>
        ) : null}
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Bot settings"
        onClick={() =>
          void navigate({
            to: "/settings/grok-bots",
            search: grokBotSettingsDestinationSearch({
              environmentId,
              botId: bot.id,
            }),
            hash: "grok-bots-editor",
          })
        }
      >
        <SettingsIcon />
      </Button>
      <Button
        size="icon-xs"
        variant={profileOpen ? "ghost" : "ghost-muted"}
        aria-pressed={profileOpen}
        aria-label={profileOpen ? "Hide bot details" : "Show bot details"}
        onClick={onToggleProfile}
      >
        <InfoIcon />
      </Button>
    </header>
  );
}

function GrokBotMessageList({
  bot,
  messages,
  environmentId,
}: {
  readonly bot: GrokBot;
  readonly messages: (typeof GrokBotConversation.Type)["messages"];
  readonly environmentId: EnvironmentId;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.at(-1)?.id, messages.at(-1)?.text, messages.at(-1)?.streaming]);

  if (messages.length === 0) {
    return (
      <Empty className="flex-1" size="default">
        <EmptyHeader>
          <GrokBotAvatar bot={bot} size="lg" />
          <EmptyTitle>Message {bot.name}</EmptyTitle>
          <EmptyDescription>
            {bot.description.trim() || "Chats stay with this bot. Start a message below."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade>
      <ol className="mx-auto flex w-full max-w-(--chat-content-max-width) flex-col gap-6 px-4 py-6">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <li key={message.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-message p-3 text-message-foreground">
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {message.text}
                </p>
              </div>
            </li>
          ) : (
            <li key={message.id} className="flex min-w-0 gap-3">
              {messages[index - 1]?.role === "assistant" ? (
                <span className="w-6 shrink-0" />
              ) : (
                <GrokBotAvatar
                  bot={bot}
                  size="xs"
                  state={message.streaming ? "streaming" : undefined}
                  className="mt-0.5"
                />
              )}
              <div className="min-w-0 flex-1">
                <ChatMarkdown
                  text={message.text}
                  cwd={undefined}
                  environmentId={environmentId}
                  isStreaming={message.streaming}
                />
              </div>
            </li>
          ),
        )}
        <div ref={endRef} />
      </ol>
    </ScrollArea>
  );
}

function GrokBotComposer({
  environmentId,
  bot,
}: {
  readonly environmentId: EnvironmentId;
  readonly bot: GrokBot;
}) {
  const canSend = useAtomValue(grokBotsSend.permissionAtom(environmentId));
  const sendMessage = useAtomCommand(grokBotsSend, { reportFailure: false });
  const identity = grokBotSurfaceKey(environmentId, bot.id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !canSend || sending;

  const submit = async () => {
    const message = draft.trim();
    if (message.length === 0 || disabled) return;
    setSending(true);
    setError(null);
    setGrokBotActivity(identity, "sending");
    const result = await sendMessage({
      environmentId,
      input: { botId: bot.id, message },
    });
    setSending(false);
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) {
        setGrokBotActivity(identity, null);
        return;
      }
      setGrokBotActivity(identity, "failed", FAILED_REACTION_MS);
      setError(grokBotFailureMessage(squashAtomCommandFailure(result)));
      return;
    }
    setGrokBotActivity(identity, "thinking", THINKING_TIMEOUT_MS);
    setDraft("");
  };

  return (
    <form
      className="px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ComposerSurface.Shell>
        <ComposerSurface.Host>
          <ComposerSurface.Main>
            <div className="rounded-3xl">
              <label className="sr-only" htmlFor={`grok-bot-composer-${identity}`}>
                Message {bot.name}
              </label>
              <textarea
                id={`grok-bot-composer-${identity}`}
                rows={2}
                value={draft}
                disabled={disabled}
                maxLength={64000}
                placeholder={`Message ${bot.name}`}
                aria-busy={sending}
                className="block max-h-52 min-h-14 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none placeholder:text-placeholder disabled:opacity-64"
                onChange={(event) => setDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2 px-3 pb-3">
                {error ? (
                  <p className="min-w-0 flex-1 truncate text-xs text-destructive-foreground">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={disabled || draft.trim().length === 0}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-message-action text-message-action-foreground hover:bg-message-action-hover disabled:opacity-30"
                >
                  {sending ? <Spinner size="xs" /> : <ArrowUpIcon className="size-4" />}
                </button>
              </div>
            </div>
          </ComposerSurface.Main>
        </ComposerSurface.Host>
      </ComposerSurface.Shell>
      <div aria-hidden className="h-4" />
    </form>
  );
}
