import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, GrokBot, PullRequestRef } from "@t3tools/contracts";
import { LinkIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";

import { DraftInput } from "~/components/ui/draft-input";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { grokBotsLink, grokBotsUpdate } from "~/state/grokBots";
import { useAtomCommand } from "~/state/use-atom-command";

import { GrokBotAppearancePicker } from "./GrokBotAppearancePicker";
import {
  grokBotFailureMessage,
  grokBotPullRequestRefFromUrl,
  grokBotSurfaceKey,
} from "./grokBotPresentation";

export function GrokBotProfileEditor({
  environmentId,
  bot,
  projects,
  compact = false,
}: {
  readonly environmentId: EnvironmentId;
  readonly bot: GrokBot;
  readonly projects: readonly EnvironmentProject[];
  readonly compact?: boolean;
}) {
  const canUpdate = useAtomValue(grokBotsUpdate.permissionAtom(environmentId));
  const canLink = useAtomValue(grokBotsLink.permissionAtom(environmentId));
  const updateBot = useAtomCommand(grokBotsUpdate, { reportFailure: false });
  const linkBot = useAtomCommand(grokBotsLink, { reportFailure: false });
  const identity = grokBotSurfaceKey(environmentId, bot.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [description, setDescription] = useState(bot.description);
  // Show a new look right away; the roster catches up after the Grok Bot round trip.
  const [pendingLook, setPendingLook] = useState<{ shape: string; color: string } | null>(null);
  const [spinSignal, setSpinSignal] = useState(0);
  if (
    pendingLook !== null &&
    pendingLook.shape === bot.avatarShape &&
    pendingLook.color === bot.avatarColor
  ) {
    setPendingLook(null);
  }
  const look = pendingLook ?? { shape: bot.avatarShape, color: bot.avatarColor };

  const save = useCallback(
    async (patch: {
      name?: string;
      label?: string;
      description?: string;
      notificationEnabled?: boolean;
      hidden?: boolean;
      pinned?: boolean;
      avatarShape?: string;
      avatarColor?: string;
    }) => {
      if (!canUpdate) return false;
      setPending(true);
      setError(null);
      const result = await updateBot({
        environmentId,
        input: { botId: bot.id, ...patch },
      });
      setPending(false);
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) {
          setError(grokBotFailureMessage(squashAtomCommandFailure(result)));
        }
        return false;
      }
      return true;
    },
    [bot.id, canUpdate, environmentId, updateBot],
  );

  const changeLook = (patch: { avatarShape?: string; avatarColor?: string }) => {
    setPendingLook({
      shape: patch.avatarShape ?? look.shape,
      color: patch.avatarColor ?? look.color,
    });
    setSpinSignal((current) => current + 1);
    void save(patch).then((saved) => {
      if (!saved) setPendingLook(null);
    });
  };

  const toggleLink = useCallback(
    async (reference: PullRequestRef, remove = false) => {
      if (!canLink) return;
      setPending(true);
      setError(null);
      const result = await linkBot({
        environmentId,
        input: { botId: bot.id, reference, ...(remove ? { remove: true } : {}) },
      });
      setPending(false);
      if (result._tag === "Failure") {
        if (isAtomCommandInterrupted(result)) return;
        setError(grokBotFailureMessage(squashAtomCommandFailure(result)));
      }
    },
    [bot.id, canLink, environmentId, linkBot],
  );

  return (
    <div className={cn("flex flex-col gap-6", compact && "gap-5")}>
      <div className="flex items-center gap-3">
        <GrokBotAppearancePicker
          shape={look.shape}
          color={look.color}
          name={bot.name}
          spinSignal={spinSignal}
          disabled={!canUpdate || pending}
          onSelectShape={(avatarShape) => changeLook({ avatarShape })}
          onSelectColor={(avatarColor) => changeLook({ avatarColor })}
        />
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{bot.name}</p>
          <p className="text-xs text-muted-foreground">Click the bot to change how it looks.</p>
        </div>
      </div>
      <EditorGroup title="Profile">
        <EditorField htmlFor={`grok-bot-name-${identity}`} label="Name">
          <DraftInput
            id={`grok-bot-name-${identity}`}
            size="sm"
            maxLength={200}
            value={bot.name}
            disabled={!canUpdate || pending}
            onCommit={(name) => {
              const next = name.trim();
              if (next.length === 0) return;
              void save({ name: next });
            }}
          />
        </EditorField>
        <EditorField
          htmlFor={`grok-bot-label-${identity}`}
          label="Role"
          hint="Shown next to the name in the sidebar."
        >
          <DraftInput
            id={`grok-bot-label-${identity}`}
            size="sm"
            maxLength={200}
            value={bot.label}
            disabled={!canUpdate || pending}
            onCommit={(label) => void save({ label })}
          />
        </EditorField>
        <EditorField
          htmlFor={`grok-bot-description-${identity}`}
          label="Instructions"
          hint="What this bot does and how it should behave. Saved when you click away."
        >
          <Textarea
            id={`grok-bot-description-${identity}`}
            size="sm"
            maxLength={16000}
            disabled={!canUpdate || pending}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            onBlur={() => {
              if (description !== bot.description) void save({ description });
            }}
          />
        </EditorField>
      </EditorGroup>
      <EditorGroup title="Sidebar and notifications">
        <EditorSwitch
          title="Pinned"
          description="Show this bot as a tile at the top of the sidebar."
          checked={bot.pinned}
          disabled={!canUpdate || pending}
          onChange={(pinned) => void save({ pinned })}
        />
        <EditorSwitch
          title="Hidden"
          description="Keep this bot out of the sidebar. It stays available here."
          checked={bot.hidden}
          disabled={!canUpdate || pending}
          onChange={(hidden) => void save({ hidden })}
        />
        <EditorSwitch
          title="Notifications"
          description="Get notified when this bot finishes or needs input."
          checked={bot.notificationEnabled}
          disabled={!canUpdate || pending}
          onChange={(notificationEnabled) => void save({ notificationEnabled })}
        />
      </EditorGroup>
      <GrokBotPullRequestLinks
        key={identity}
        bot={bot}
        projects={projects}
        disabled={!canLink || pending}
        onAdd={(reference) => void toggleLink(reference)}
        onRemove={(reference) => void toggleLink(reference, true)}
      />
      {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
    </div>
  );
}

function GrokBotPullRequestLinks({
  bot,
  projects,
  disabled,
  onAdd,
  onRemove,
}: {
  readonly bot: GrokBot;
  readonly projects: readonly EnvironmentProject[];
  readonly disabled: boolean;
  readonly onAdd: (reference: PullRequestRef) => void;
  readonly onRemove: (reference: PullRequestRef) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const resolvedProjectId = projects.some((project) => project.id === projectId)
    ? projectId
    : (projects[0]?.id ?? "");
  const selectedProject = projects.find((project) => project.id === resolvedProjectId) ?? null;

  const submit = () => {
    if (selectedProject === null) {
      setLocalError("Choose a project that can read the pull request.");
      return;
    }
    const reference = grokBotPullRequestRefFromUrl(url, selectedProject);
    if (reference === null) {
      setLocalError("Paste a GitHub pull request URL.");
      return;
    }
    setLocalError(null);
    setUrl("");
    onAdd(reference);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Pull requests</p>
        <p className="text-xs text-muted-foreground">
          Attach existing GitHub pull requests. This does not create a pull request.
        </p>
      </div>
      {bot.pullRequests.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {bot.pullRequests.map((pullRequest) => (
            <GrokBotPullRequestRow
              key={`${pullRequest.reference.projectId}:${pullRequest.reference.repository}:${pullRequest.reference.number}`}
              pullRequest={pullRequest}
              disabled={disabled}
              onRemove={() => onRemove(pullRequest.reference)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No pull requests linked.</p>
      )}
      <div className="flex flex-col gap-2">
        <Select
          value={resolvedProjectId}
          onValueChange={(value) => setProjectId(value ?? "")}
          disabled={disabled || projects.length === 0}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>
              {selectedProject?.title ??
                (projects.length === 0 ? "No projects" : "Choose a project")}
            </SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <div className="flex gap-2">
          <Input
            size="sm"
            value={url}
            disabled={disabled}
            placeholder="https://github.com/org/repo/pull/123"
            aria-label="GitHub pull request URL"
            onChange={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          <Button size="sm" variant="outline" disabled={disabled} onClick={submit}>
            <LinkIcon />
            Link
          </Button>
        </div>
        {localError ? <p className="text-xs text-destructive-foreground">{localError}</p> : null}
      </div>
    </div>
  );
}

function GrokBotPullRequestRow({
  pullRequest,
  disabled,
  onRemove,
}: {
  readonly pullRequest: GrokBot["pullRequests"][number];
  readonly disabled: boolean;
  readonly onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/50 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <a
          href={pullRequest.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium text-foreground hover:underline"
        >
          {pullRequest.title ||
            `${pullRequest.reference.repository}#${pullRequest.reference.number}`}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {pullRequest.reference.repository}#{pullRequest.reference.number} · {pullRequest.state}
        </p>
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        disabled={disabled}
        aria-label="Remove pull request link"
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

function EditorGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-3">{children}</div>
    </section>
  );
}

function EditorField({
  htmlFor,
  label,
  hint,
  children,
}: {
  readonly htmlFor: string;
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EditorSwitch({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        size="sm"
        checked={checked}
        disabled={disabled}
        aria-label={title}
        onCheckedChange={onChange}
      />
    </div>
  );
}
