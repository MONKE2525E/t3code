import type {
  PullRequestAction,
  PullRequestDetail,
  PullRequestMergeMethod,
} from "@t3tools/contracts";
import {
  openOnHostLabel,
  PULL_REQUEST_MERGE_METHOD_LABELS,
  pullRequestHandoffLabels,
  resolvePullRequestPrimaryControl,
} from "@t3tools/shared/pullRequestHandoff";

import type { AppSymbolName } from "../../components/AppSymbol";

/** The desktop's checks rollup: failures first, then anything still waiting, then a pass. */
function checksState(checks: PullRequestDetail["checks"]) {
  if (checks.length === 0) return null;
  const statuses = new Set(checks.map((check) => check.status));
  if (statuses.has("failure") || statuses.has("cancelled")) return "failing" as const;
  if (statuses.has("pending") || statuses.has("action-required")) return "pending" as const;
  return statuses.has("success") ? ("passing" as const) : null;
}

export type PullRequestMenuCommand =
  | { readonly kind: "link"; readonly linked: boolean }
  | { readonly kind: "refresh" }
  | { readonly kind: "ask" }
  | { readonly kind: "explain" }
  | { readonly kind: "fix-findings" }
  | { readonly kind: "action"; readonly action: PullRequestAction }
  | { readonly kind: "merge"; readonly method: PullRequestMergeMethod }
  | { readonly kind: "enable-auto-merge"; readonly method: PullRequestMergeMethod }
  | { readonly kind: "open-host" }
  | { readonly kind: "copy-link" }
  | { readonly kind: "copy-number" };

export interface PullRequestMenuItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon: AppSymbolName;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly command: PullRequestMenuCommand;
}

/** The pull request state the menu reads; the detail plus what the screen knows around it. */
export interface PullRequestMenuInput {
  readonly detail: Pick<
    PullRequestDetail,
    | "state"
    | "isDraft"
    | "mergeability"
    | "autoMergeEnabled"
    | "autoMergeMethod"
    | "capabilities"
    | "viewerPermissions"
    | "mergeCapabilities"
    | "checks"
    | "provider"
  >;
  /** The thread the viewer was opened from, or null when opened from the pull request list. */
  readonly thread: { readonly linked: boolean; readonly canLink: boolean } | null;
  /** False while a stacked pull request's stack is unknown, or when it belongs to one. */
  readonly canMergeSingle: boolean;
  readonly mergeMethod: PullRequestMergeMethod;
  readonly refreshing: boolean;
  readonly actionPending: boolean;
  readonly handoffPending: boolean;
}

/** The merge strategies the host offers that this repository also allows. */
export function allowedMergeMethods(
  detail: Pick<PullRequestDetail, "capabilities" | "mergeCapabilities">,
): PullRequestMergeMethod[] {
  return detail.capabilities.mergeMethods.filter((method) => detail.mergeCapabilities[method]);
}

/**
 * The three-dot menu, grouped where the desktop menu draws separators. Every guard is the
 * desktop panel's: the host must offer an action and this account must be allowed it, a draft
 * or conflicting branch offers no merge, and a pull request in a host stack is merged from the
 * stack. Where the desktop header holds the primary button, the phone has no header button, so
 * each merge strategy is its own row instead of a radio group beside a Merge button.
 */
export function pullRequestMenuGroups(input: PullRequestMenuInput): PullRequestMenuItem[][] {
  const { detail } = input;
  const can = (action: PullRequestAction) =>
    detail.capabilities.actions.includes(action) &&
    detail.viewerPermissions.actions.includes(action);
  const open = detail.state === "open";
  const conflicting = open && detail.mergeability === "conflicting";
  const methods = allowedMergeMethods(detail);
  const autoMergeArmed = open && detail.autoMergeEnabled === true;
  const primary = resolvePullRequestPrimaryControl({
    state: detail.state,
    isDraft: detail.isDraft,
    mergeability: detail.mergeability,
    checksState: checksState(detail.checks),
    autoMergeEnabled: detail.autoMergeEnabled,
    hasMergeMethod: methods.length > 0,
    canMerge: input.canMergeSingle && can("merge"),
    canMarkReady: can("ready"),
    canEnableAutoMerge: input.canMergeSingle && can("enable-auto-merge"),
  });
  const handoffLabels = pullRequestHandoffLabels(input.thread !== null);
  const busy = input.actionPending;

  const agent: PullRequestMenuItem[] = [];
  if (input.thread && (input.thread.linked || input.thread.canLink)) {
    agent.push({
      id: "link",
      title: input.thread.linked ? "Unlink from this thread" : "Link to this thread",
      icon: input.thread.linked ? "pin.slash" : "link",
      disabled: busy,
      command: { kind: "link", linked: input.thread.linked },
    });
  }
  agent.push(
    {
      id: "refresh",
      title: "Refresh",
      icon: "arrow.clockwise",
      disabled: input.refreshing,
      command: { kind: "refresh" },
    },
    {
      id: "ask",
      title: "Ask a question",
      subtitle: input.thread
        ? "Adds the pull request to this thread's composer."
        : "Opens a thread that knows which pull request you mean.",
      icon: "text.bubble",
      disabled: input.handoffPending || busy,
      command: { kind: "ask" },
    },
    {
      id: "explain",
      title: "Explain this PR",
      subtitle: "A walk through the diff and what to read closely.",
      icon: "doc.text",
      disabled: input.handoffPending || busy,
      command: { kind: "explain" },
    },
    {
      id: "fix-findings",
      title: handoffLabels.fixFindings,
      icon: "hammer",
      disabled: input.handoffPending || busy,
      command: { kind: "fix-findings" },
    },
  );

  const actions: PullRequestMenuItem[] = [];
  if (open) {
    if (can(detail.isDraft ? "ready" : "draft")) {
      actions.push({
        id: "draft",
        title: detail.isDraft ? "Ready for review" : "Convert to draft",
        icon: detail.isDraft ? "eye" : "doc",
        disabled: busy,
        command: { kind: "action", action: detail.isDraft ? "ready" : "draft" },
      });
    }
    const mergeable = input.canMergeSingle && !detail.isDraft && !conflicting;
    if (mergeable && can("merge")) {
      for (const method of methods) {
        actions.push({
          id: `merge:${method}`,
          title: PULL_REQUEST_MERGE_METHOD_LABELS[method],
          icon: "arrow.triangle.merge",
          disabled: busy,
          command: { kind: "merge", method },
        });
      }
    }
    if (autoMergeArmed && input.canMergeSingle && can("disable-auto-merge")) {
      actions.push({
        id: "disable-auto-merge",
        title: "Disable auto-merge",
        icon: "bolt.circle",
        disabled: busy,
        command: { kind: "action", action: "disable-auto-merge" },
      });
    } else if (
      !autoMergeArmed &&
      mergeable &&
      can("enable-auto-merge") &&
      methods.length > 0 &&
      // Auto-merge only means something while the host is still waiting on checks.
      primary === "enable-auto-merge"
    ) {
      actions.push({
        id: "enable-auto-merge",
        title: "Enable auto-merge",
        subtitle: PULL_REQUEST_MERGE_METHOD_LABELS[input.mergeMethod],
        icon: "bolt.circle",
        disabled: busy,
        command: { kind: "enable-auto-merge", method: input.mergeMethod },
      });
    }
  }

  const share: PullRequestMenuItem[] = [
    {
      id: "open-host",
      title: openOnHostLabel(detail.provider),
      icon: "safari",
      command: { kind: "open-host" },
    },
    { id: "copy-link", title: "Copy link", icon: "link", command: { kind: "copy-link" } },
    {
      id: "copy-number",
      title: "Copy PR number",
      icon: "doc.on.doc",
      command: { kind: "copy-number" },
    },
  ];

  const lifecycle: PullRequestMenuItem[] = [];
  if (open && can("close")) {
    lifecycle.push({
      id: "close",
      title: "Close pull request",
      icon: "xmark.circle",
      destructive: true,
      disabled: busy,
      command: { kind: "action", action: "close" },
    });
  } else if (detail.state === "closed" && can("reopen")) {
    lifecycle.push({
      id: "reopen",
      title: "Reopen pull request",
      icon: "arrow.uturn.backward",
      disabled: busy,
      command: { kind: "action", action: "reopen" },
    });
  } else if (detail.state === "merged" && can("revert")) {
    lifecycle.push({
      id: "revert",
      title: "Revert changes",
      icon: "arrow.uturn.backward",
      disabled: busy,
      command: { kind: "action", action: "revert" },
    });
  }

  return [agent, actions, share, lifecycle].filter((group) => group.length > 0);
}

/**
 * What to ask before a host action that cannot be taken back from here, worded as the desktop
 * dialog words it. Null for the actions the desktop runs on the press.
 */
export function pullRequestActionConfirmation(
  command: PullRequestMenuCommand,
  number: number,
): { title: string; message: string; confirmText: string; destructive: boolean } | null {
  switch (command.kind) {
    case "merge":
      return {
        title: "Merge pull request?",
        message: `This merges #${number} using ${command.method}.`,
        confirmText: PULL_REQUEST_MERGE_METHOD_LABELS[command.method],
        destructive: false,
      };
    case "enable-auto-merge":
      return {
        title: "Enable auto-merge?",
        message: `This merges #${number} using ${command.method} as soon as the host considers it ready, which may be immediately.`,
        confirmText: "Enable auto-merge",
        destructive: false,
      };
    case "action":
      if (command.action === "close")
        return {
          title: "Close pull request?",
          message: `This closes #${number} without merging it.`,
          confirmText: "Close",
          destructive: true,
        };
      if (command.action === "revert")
        return {
          title: "Revert these changes?",
          message: `This opens a new pull request that reverses the changes merged by #${number}.`,
          confirmText: "Create revert PR",
          destructive: false,
        };
      return null;
    default:
      return null;
  }
}
