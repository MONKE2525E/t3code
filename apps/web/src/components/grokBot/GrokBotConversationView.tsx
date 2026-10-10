import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { GrokBotConversation, type EnvironmentId, type GrokBot } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { PanelRightIcon, SettingsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
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
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useProjects } from "~/state/entities";
import { grokBotsReadQuery, grokBotsSend } from "~/state/grokBots";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotAvatar } from "./GrokBotAvatar";
import { GrokBotLimitations } from "./GrokBotLimitations";
import { GrokBotProfileEditor } from "./GrokBotProfileEditor";
import {
  grokBotFailureMessage,
  grokBotSettingsDestinationSearch,
  grokBotSurfaceKey,
} from "./grokBotPresentation";

export function GrokBotConversationView({
  environmentId,
  botId,
}: {
  readonly environmentId: EnvironmentId;
  readonly botId: string;
}) {
  const conversation = useEnvironmentQuery(grokBotsReadQuery({ environmentId, input: { botId } }));
  const projects = useProjects().filter((project) => project.environmentId === environmentId);
  const [profileOpen, setProfileOpen] = useState(true);
  const bot = conversation.data?.bot ?? null;
  const messages = conversation.data?.messages ?? [];

  if (conversation.isPending && conversation.data === null) {
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

  const surfaceKey = grokBotSurfaceKey(environmentId, bot.id);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
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
        <aside className="hidden min-h-0 w-[22rem] shrink-0 overflow-y-auto border-l border-border/60 px-4 py-5 lg:block">
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
  return (
    <header className="flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 border-b border-border/50 px-4">
      <GrokBotAvatar bot={bot} size="sm" featured={bot.featured} />
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
        variant={profileOpen ? "default" : "ghost"}
        aria-pressed={profileOpen}
        aria-label={profileOpen ? "Hide profile" : "Show profile"}
        className="hidden lg:inline-flex"
        onClick={onToggleProfile}
      >
        <PanelRightIcon />
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
      <ol className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            {message.role === "assistant" ? <GrokBotAvatar bot={bot} size="sm" /> : null}
            <div
              className={cn(
                "min-w-0 max-w-[min(42rem,85%)] rounded-xl px-3 py-2",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground",
              )}
            >
              {message.role === "assistant" ? (
                <ChatMarkdown
                  text={message.text}
                  cwd={undefined}
                  environmentId={environmentId}
                  headingLevelOffset={1}
                  isStreaming={message.streaming}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {message.text}
                </p>
              )}
            </div>
          </li>
        ))}
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
    const result = await sendMessage({
      environmentId,
      input: { botId: bot.id, message },
    });
    setSending(false);
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      setError(grokBotFailureMessage(squashAtomCommandFailure(result)));
      return;
    }
    setDraft("");
  };

  return (
    <form
      className="border-t border-border/50 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <label className="sr-only" htmlFor={`grok-bot-composer-${identity}`}>
          Message {bot.name}
        </label>
        <Textarea
          id={`grok-bot-composer-${identity}`}
          size="sm"
          value={draft}
          disabled={disabled}
          maxLength={64000}
          placeholder={`Message ${bot.name}`}
          aria-label={`Message ${bot.name}`}
          aria-busy={sending}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Enter to send, Shift+Enter for a new line.
          </p>
          <Button size="sm" type="submit" disabled={disabled || draft.trim().length === 0}>
            {sending ? <Spinner size="xs" /> : null}
            Send
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
      </div>
    </form>
  );
}
