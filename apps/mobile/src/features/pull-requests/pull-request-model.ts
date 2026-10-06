import type {
  PullRequestCheck,
  PullRequestInvolvement,
  PullRequestListEntry,
  PullRequestListState,
  PullRequestMergeability,
  PullRequestState,
} from "@t3tools/contracts";

import type { AppSymbolName } from "../../components/AppSymbol";

/** What the list asks the hosts for, plus the local ordering of what came back. */
export interface PullRequestFilters {
  readonly state: PullRequestListState;
  readonly involvement: PullRequestInvolvement;
  readonly projectId: string | undefined;
  readonly sort: PullRequestSort;
}

export const DEFAULT_PULL_REQUEST_FILTERS: PullRequestFilters = {
  state: "open",
  involvement: "all",
  projectId: undefined,
  sort: "updated",
};

export const PULL_REQUEST_STATE_OPTIONS: ReadonlyArray<{
  readonly value: PullRequestListState;
  readonly label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "merged", label: "Merged" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export const PULL_REQUEST_INVOLVEMENT_OPTIONS: ReadonlyArray<{
  readonly value: PullRequestInvolvement;
  readonly label: string;
}> = [
  { value: "all", label: "Everyone" },
  { value: "reviewing", label: "Review requested" },
  { value: "authored", label: "Authored by me" },
];

/**
 * Orderings the list can honour from the rows it holds. They reorder what has loaded; the hosts
 * still hand pages over by recency, so a later page can slot in above an earlier one.
 */
export type PullRequestSort = "updated" | "stale" | "newest" | "oldest";

export const PULL_REQUEST_SORT_OPTIONS: ReadonlyArray<{
  readonly value: PullRequestSort;
  readonly label: string;
}> = [
  { value: "updated", label: "Recently updated" },
  { value: "stale", label: "Least recently updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortPullRequests(
  entries: ReadonlyArray<PullRequestListEntry>,
  sort: PullRequestSort,
): ReadonlyArray<PullRequestListEntry> {
  const field = sort === "updated" || sort === "stale" ? "updatedAt" : "createdAt";
  const direction = sort === "updated" || sort === "newest" ? -1 : 1;
  return [...entries].sort(
    (a, b) =>
      direction * (timestamp(a[field]) - timestamp(b[field])) ||
      pullRequestRowKey(a).localeCompare(pullRequestRowKey(b)),
  );
}

/** Filters that differ from what the screen opens with; the sort is shown by its own control. */
export function countActivePullRequestFilters(filters: PullRequestFilters) {
  return (
    Number(filters.state !== DEFAULT_PULL_REQUEST_FILTERS.state) +
    Number(filters.involvement !== DEFAULT_PULL_REQUEST_FILTERS.involvement) +
    Number(filters.projectId !== undefined)
  );
}

export function pullRequestRowKey(entry: PullRequestListEntry): string {
  return JSON.stringify([entry.host, entry.repository, entry.number]);
}

export function mergePullRequestPages(pages: ReadonlyArray<ReadonlyArray<PullRequestListEntry>>) {
  const entries = new Map<string, PullRequestListEntry>();
  for (const page of pages) {
    for (const entry of page) entries.set(pullRequestRowKey(entry), entry);
  }
  return [...entries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function matchesPullRequestQuery(entry: PullRequestListEntry, query: string) {
  const needle = query.trim().toLowerCase().replace(/^#/, "");
  return (
    !needle ||
    `${entry.number} ${entry.title} ${entry.repository} ${entry.headBranch} ${entry.author?.login ?? ""}`
      .toLowerCase()
      .includes(needle)
  );
}

export function parseNativePullRequestUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const match = /^\/(.+)\/pull\/(\d+)\/?$/.exec(parsed.pathname);
    if (!match) return null;
    const number = Number(match[2]);
    return Number.isSafeInteger(number) && number > 0
      ? { host: parsed.host, repository: match[1]!, number }
      : null;
  } catch {
    return null;
  }
}

// Use the pane's available width: the persistent workspace sidebar already
// consumes part of the unfolded screen.
export function usesPullRequestSplitView(width: number) {
  return width >= 680;
}

type PresentationScheme = "light" | "dark";

export interface PullRequestPresentation {
  readonly label: string;
  readonly color: string;
  readonly icon: AppSymbolName;
}

const STATE_COLORS = {
  open: { light: "#059669", dark: "#6ee7b7" },
  merged: { light: "#7c3aed", dark: "#c4b5fd" },
  closed: { light: "#dc2626", dark: "#fca5a5" },
  draft: { light: "#71717a", dark: "#a1a1aa" },
  conflicts: { light: "#dc2626", dark: "#fca5a5" },
} as const;

/**
 * How a pull request reads in the list and the detail header. The same ink as the desktop page
 * uses for open, merged and closed. A draft outranks conflicts, because a draft is not heading
 * for a merge yet.
 */
export function resolvePullRequestPresentation(
  input: {
    readonly state: PullRequestState;
    readonly isDraft: boolean;
    readonly mergeability?: PullRequestMergeability;
  },
  scheme: PresentationScheme,
): PullRequestPresentation {
  if (input.state === "merged") {
    return {
      label: "Merged",
      color: STATE_COLORS.merged[scheme],
      icon: "point.topleft.down.curvedto.point.bottomright.up",
    };
  }
  if (input.state === "closed") {
    return { label: "Closed", color: STATE_COLORS.closed[scheme], icon: "xmark.circle" };
  }
  if (input.isDraft) {
    return { label: "Draft", color: STATE_COLORS.draft[scheme], icon: "circle.dashed" };
  }
  if (input.mergeability === "conflicting") {
    return {
      label: "Conflicts",
      color: STATE_COLORS.conflicts[scheme],
      icon: "exclamationmark.triangle",
    };
  }
  return { label: "Open", color: STATE_COLORS.open[scheme], icon: "arrow.triangle.pull" };
}

export type PullRequestChecksTone = "none" | "success" | "failure" | "pending";

export interface PullRequestChecksSummary {
  readonly tone: PullRequestChecksTone;
  readonly label: string;
}

/** One line for the header: failures outrank running checks, which outrank a clean run. */
export function summarizePullRequestChecks(
  checks: ReadonlyArray<Pick<PullRequestCheck, "status">>,
): PullRequestChecksSummary {
  if (checks.length === 0) return { tone: "none", label: "No checks" };
  const failed = checks.filter(
    (check) =>
      check.status === "failure" ||
      check.status === "action-required" ||
      check.status === "cancelled",
  ).length;
  const pending = checks.filter((check) => check.status === "pending").length;
  const plural = (count: number) => (count === 1 ? "check" : "checks");
  if (failed > 0) {
    return {
      tone: "failure",
      label: `${failed} of ${checks.length} ${plural(checks.length)} failing`,
    };
  }
  if (pending > 0) {
    return { tone: "pending", label: `${pending} ${plural(pending)} running` };
  }
  return { tone: "success", label: `${checks.length} ${plural(checks.length)} passed` };
}

const CHECK_ORDER: Record<PullRequestCheck["status"], number> = {
  "action-required": 0,
  failure: 0,
  cancelled: 0,
  pending: 1,
  success: 2,
  neutral: 3,
  skipped: 3,
};

/** Checks that need attention first, otherwise in the host's order. */
export function sortPullRequestChecks<T extends Pick<PullRequestCheck, "status">>(
  checks: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return [...checks].sort((a, b) => CHECK_ORDER[a.status] - CHECK_ORDER[b.status]);
}

export type PullRequestListStatus =
  | { readonly kind: "rows" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly title: string; readonly message: string }
  | { readonly kind: "setup"; readonly title: string; readonly message: string }
  | { readonly kind: "empty-search" | "empty-filtered" | "empty" };

export interface PullRequestListHealth {
  /** The listing's own failure, such as a rate limit or a dropped connection. */
  readonly error: string | null;
  /** Projects whose repository could not be read this time. */
  readonly projectErrors: ReadonlyArray<{
    readonly projectTitle: string;
    readonly message: string;
  }>;
  /** Hosts that cannot be read until they are configured on the environment. */
  readonly unconfigured: ReadonlyArray<{ readonly host: string; readonly detail: string | null }>;
}

const SETUP_FALLBACK = "Configure this provider on the environment.";

/**
 * Decides what the list body shows when it has no rows, so a failure, a setup gap and a real
 * empty answer never share one message. With rows on screen the list is always "rows" and the
 * same facts come back as a notice instead.
 */
export function resolvePullRequestListStatus(input: {
  readonly rowCount: number;
  readonly hasData: boolean;
  readonly pending: boolean;
  readonly query: string;
  readonly filterCount: number;
  readonly health: PullRequestListHealth;
}): PullRequestListStatus {
  if (input.rowCount > 0) return { kind: "rows" };
  const { health } = input;
  if (!input.hasData) {
    return health.error
      ? { kind: "error", title: "Could not load pull requests", message: health.error }
      : input.pending
        ? { kind: "loading" }
        : { kind: "empty" };
  }
  if (health.projectErrors.length > 0) {
    return {
      kind: "error",
      title: "Could not load pull requests",
      message: health.projectErrors
        .map((error) => `${error.projectTitle}: ${error.message}`)
        .join("\n"),
    };
  }
  if (health.unconfigured.length > 0) {
    return {
      kind: "setup",
      title: "Pull requests are not set up",
      message: health.unconfigured
        .map((provider) => `${provider.host}: ${provider.detail ?? SETUP_FALLBACK}`)
        .join("\n"),
    };
  }
  if (input.query.trim()) return { kind: "empty-search" };
  return { kind: input.filterCount > 0 ? "empty-filtered" : "empty" };
}

/**
 * Problems worth a line above rows that did load: a failed refresh, projects that were left
 * out, hosts that need setup. One list, so the same fact is never said in two banners.
 */
export function resolvePullRequestNotices(health: PullRequestListHealth): ReadonlyArray<string> {
  return [
    ...(health.error ? [health.error] : []),
    ...health.projectErrors.map((error) => `${error.projectTitle}: ${error.message}`),
    ...health.unconfigured.map(
      (provider) => `${provider.host}: ${provider.detail ?? SETUP_FALLBACK}`,
    ),
  ];
}
