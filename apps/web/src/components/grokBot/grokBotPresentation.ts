import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, type GrokBot, type PullRequestRef } from "@t3tools/contracts";
import { parseChangeRequestUrl } from "@t3tools/shared/changeRequestUrl";
import type { SearchMiddleware } from "@tanstack/react-router";

import {
  GROK_BOT_AVATAR_COLOR_ALIASES,
  GROK_BOT_AVATAR_COLORS,
  GROK_BOT_AVATAR_KIND_ALIASES,
  GROK_BOT_AVATAR_KINDS,
  type GrokBotAvatarKind,
} from "./grokBotAvatarShapes";

export function compareGrokBots(left: GrokBot, right: GrokBot): number {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  return left.name.localeCompare(right.name);
}

/** Featured tiles sit above the list; hidden bots stay out of the roster. */
export function partitionGrokBotRoster(bots: readonly GrokBot[]): {
  readonly featured: readonly GrokBot[];
  readonly rows: readonly GrokBot[];
} {
  const visible = bots.filter((bot) => !bot.hidden);
  const featured = visible.filter((bot) => bot.featured).toSorted(compareGrokBots);
  const featuredIds = new Set(featured.map((bot) => bot.id));
  return {
    featured,
    rows: visible.filter((bot) => !featuredIds.has(bot.id)).toSorted(compareGrokBots),
  };
}

export function sortGrokBotsForEditor(bots: readonly GrokBot[]): readonly GrokBot[] {
  return bots.toSorted((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return compareGrokBots(left, right);
  });
}

export function grokBotFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Grok Bot could not complete that request.";
}

/**
 * Same GitHub host rule `parseChangeRequestUrl` uses: github.com, a subdomain of
 * it, or an Enterprise hostname that includes a `github` label.
 */
export function isGitHubChangeRequestHost(host: string): boolean {
  const hostname = host.trim().toLowerCase();
  return (
    hostname === "github.com" ||
    hostname.endsWith(".github.com") ||
    hostname.split(".").includes("github")
  );
}

const GITHUB_PULL_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/u;

/** Grok Bot links GitHub pull requests, including Enterprise `/owner/repo/pull/n` URLs. */
export function isGrokBotPullRequestUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return false;
    return (
      isGitHubChangeRequestHost(parsedUrl.hostname) && GITHUB_PULL_PATH.test(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

export function grokBotPullRequestRefFromUrl(
  url: string,
  project: Pick<EnvironmentProject, "id">,
): PullRequestRef | null {
  if (!isGrokBotPullRequestUrl(url)) return null;
  const parsed = parseChangeRequestUrl(url);
  if (parsed === null) return null;
  return {
    projectId: project.id,
    host: parsed.authority ?? parsed.host,
    repository: parsed.repository,
    number: parsed.number,
  };
}

export function grokBotSurfaceKey(environmentId: string, botId: string): string {
  return `${environmentId}:${botId}`;
}

export type GrokBotSettingsSearch = {
  readonly botId?: GrokBot["id"];
};

export type GrokBotSettingsDestinationSearch = GrokBotSettingsSearch & {
  readonly machine?: EnvironmentId;
};

/** Settings scope uses `machine`; a bot destination must not keep a previous project checkout. */
export function grokBotSettingsDestinationSearch(input: {
  readonly environmentId?: EnvironmentId | null | undefined;
  readonly botId?: string | null | undefined;
}): GrokBotSettingsDestinationSearch {
  const botId = input.botId?.trim();
  return {
    ...(input.environmentId ? { machine: input.environmentId } : {}),
    ...(botId && botId.length > 0 ? { botId } : {}),
  };
}

export function retainGrokBotSettingsBotIdSearch<T extends GrokBotSettingsSearch>(
  previous: T,
  next: T,
): T {
  if (Object.hasOwn(next, "botId")) return next;
  return typeof previous.botId === "string" && previous.botId.trim().length > 0
    ? { ...next, botId: previous.botId }
    : next;
}

export const retainGrokBotSettingsBotId: SearchMiddleware<GrokBotSettingsSearch> = ({
  search,
  next,
}) => retainGrokBotSettingsBotIdSearch(search, next(search));

export type GrokBotSettingsEnvironmentResolution =
  | { readonly kind: "environment"; readonly environmentId: EnvironmentId }
  | { readonly kind: "disconnected"; readonly environmentId: EnvironmentId }
  | { readonly kind: "choose-environment" }
  | { readonly kind: "no-environment" };

export function resolveGrokBotSettingsEnvironment(input: {
  readonly scopeKind: "all" | "environment" | "project" | "checkout" | "unavailable";
  readonly scopeEnvironmentId?: string | null;
  readonly connectedEnvironmentIds: readonly string[];
}): GrokBotSettingsEnvironmentResolution {
  if (input.scopeKind === "environment") {
    const raw = input.scopeEnvironmentId?.trim() ?? "";
    if (raw.length === 0) return { kind: "choose-environment" };
    const environmentId = EnvironmentId.make(raw);
    return input.connectedEnvironmentIds.includes(environmentId)
      ? { kind: "environment", environmentId }
      : { kind: "disconnected", environmentId };
  }
  return input.connectedEnvironmentIds.length === 0
    ? { kind: "no-environment" }
    : { kind: "choose-environment" };
}

export type GrokBotSelectedEnvironmentResolution =
  | { readonly kind: "environment"; readonly environmentId: EnvironmentId }
  | { readonly kind: "disconnected"; readonly environmentId: EnvironmentId }
  | { readonly kind: "no-environment" };

/**
 * Chat and the sidebar keep an explicit destination, even when it is
 * disconnected, so settings can show the unavailable-scope notice.
 */
export function resolveGrokBotSelectedEnvironment(input: {
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly connectedEnvironmentIds: readonly string[];
}): GrokBotSelectedEnvironmentResolution {
  if (input.selectedEnvironmentId === null) return { kind: "no-environment" };
  return input.connectedEnvironmentIds.includes(input.selectedEnvironmentId)
    ? { kind: "environment", environmentId: input.selectedEnvironmentId }
    : { kind: "disconnected", environmentId: input.selectedEnvironmentId };
}

export function validateGrokBotConversationSearch(raw: Record<string, unknown>): {
  readonly environmentId?: EnvironmentId;
} {
  return typeof raw.environmentId === "string" && raw.environmentId.trim().length > 0
    ? { environmentId: EnvironmentId.make(raw.environmentId) }
    : {};
}

export function validateGrokBotSettingsSearch(raw: Record<string, unknown>): GrokBotSettingsSearch {
  return typeof raw.botId === "string" && raw.botId.trim().length > 0
    ? { botId: raw.botId.trim() }
    : {};
}

export function resolveGrokBotAvatarKind(shape: string): GrokBotAvatarKind {
  const token = shape.trim().toLowerCase();
  const known = GROK_BOT_AVATAR_KINDS.find((kind) => kind === token);
  if (known) return known;
  return (
    GROK_BOT_AVATAR_KIND_ALIASES[token] ??
    GROK_BOT_AVATAR_KINDS[hashString(token || "blob") % GROK_BOT_AVATAR_KINDS.length]!
  );
}

const FALLBACK_COLORS = Object.values(GROK_BOT_AVATAR_COLORS).filter(
  (value) => value !== GROK_BOT_AVATAR_COLORS.black,
);

export function resolveGrokBotAvatarFill(color: string): string {
  const token = color.trim().toLowerCase();
  const named = Object.hasOwn(GROK_BOT_AVATAR_COLORS, token)
    ? GROK_BOT_AVATAR_COLORS[token as keyof typeof GROK_BOT_AVATAR_COLORS]
    : GROK_BOT_AVATAR_COLOR_ALIASES[token];
  if (named) return named;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(token)) return token;
  return FALLBACK_COLORS[hashString(token || "bot") % FALLBACK_COLORS.length]!;
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}
