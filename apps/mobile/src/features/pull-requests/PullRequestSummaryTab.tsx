import type { PullRequestActivity, PullRequestDetail } from "@t3tools/contracts";
import { pullRequestReviewerEntries } from "@t3tools/shared/pullRequestHandoff";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type AppSymbolName, SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { FileMarkdownPreview } from "../files/FileMarkdownPreview";
import {
  sortPullRequestChecks,
  summarizePullRequestChecks,
  type PullRequestChecksTone,
} from "./pull-request-model";

const CHECK_ICON: Record<PullRequestDetail["checks"][number]["status"], AppSymbolName> = {
  "action-required": "exclamationmark.triangle",
  success: "checkmark.circle",
  failure: "xmark.circle",
  cancelled: "xmark.circle",
  pending: "clock",
  skipped: "circle.dashed",
  neutral: "circle.dashed",
};

const CHECK_STATUS_LABEL: Record<PullRequestDetail["checks"][number]["status"], string> = {
  "action-required": "Action required",
  success: "Passed",
  failure: "Failed",
  cancelled: "Cancelled",
  pending: "Running",
  skipped: "Skipped",
  neutral: "Neutral",
};

/** Which Summary sections are open. Owned by the pane so a tab switch or a fold keeps them. */
export interface PullRequestSummarySections {
  readonly description: boolean;
  readonly checks: boolean;
}

/** The desktop's defaults: the description open, the checks folded behind their summary. */
export const DEFAULT_PULL_REQUEST_SUMMARY_SECTIONS: PullRequestSummarySections = {
  description: true,
  checks: false,
};

/** One ink per outcome, readable on both themes and shared with the header summary. */
export function useChecksToneColor() {
  const dark = useColorScheme() === "dark";
  return (tone: PullRequestChecksTone | PullRequestDetail["checks"][number]["status"]) => {
    switch (tone) {
      case "success":
        return dark ? "#6ee7b7" : "#059669";
      case "failure":
      case "cancelled":
        return dark ? "#fca5a5" : "#dc2626";
      case "pending":
        return dark ? "#fcd34d" : "#b45309";
      default:
        return dark ? "#a1a1aa" : "#71717a";
    }
  };
}

/** A collapsible section heading, the whole row one touch target, as the desktop's is. */
function Section(props: {
  title: string;
  detail?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const iconColor = String(useUniwindTheme()["--color-icon-muted"]);
  return (
    <View className="border-t border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.title}
        accessibilityState={{ expanded: props.open }}
        onPress={props.onToggle}
        className="min-h-12 flex-row items-center gap-2 px-4 active:bg-subtle"
      >
        <Text className="text-[13px] font-t3-bold text-foreground-secondary">{props.title}</Text>
        <SymbolView
          name={props.open ? "chevron.down" : "chevron.right"}
          size={14}
          tintColor={iconColor}
          type="monochrome"
        />
        <View className="min-w-0 flex-1 flex-row justify-end">{props.detail}</View>
      </Pressable>
      {props.open ? <View className="pb-3">{props.children}</View> : null}
    </View>
  );
}

function ChecksSummary(props: { checks: PullRequestDetail["checks"] }) {
  const colorFor = useChecksToneColor();
  const summary = summarizePullRequestChecks(props.checks);
  if (summary.tone === "none") {
    return <Text className="text-xs text-foreground-tertiary">{summary.label}</Text>;
  }
  return (
    <View className="flex-row items-center gap-1">
      <SymbolView
        name={
          summary.tone === "success"
            ? "checkmark.circle"
            : summary.tone === "failure"
              ? "xmark.circle"
              : "clock"
        }
        size={13}
        tintColor={colorFor(summary.tone)}
        type="monochrome"
      />
      <Text numberOfLines={1} className="text-xs text-foreground-muted">
        {summary.label}
      </Text>
    </View>
  );
}

function Checks(props: { checks: PullRequestDetail["checks"] }) {
  const colorFor = useChecksToneColor();
  if (props.checks.length === 0) {
    return <Text className="px-4 text-sm text-foreground-muted">No checks reported.</Text>;
  }
  return (
    <View>
      {sortPullRequestChecks(props.checks).map((check) => (
        <Pressable
          key={`${check.name}:${check.url ?? ""}`}
          accessibilityRole={check.url ? "link" : "text"}
          accessibilityLabel={`${check.name}, ${CHECK_STATUS_LABEL[check.status]}`}
          disabled={!check.url}
          onPress={() => check.url && void tryOpenExternalUrl(check.url, "pull-request")}
          className="min-h-11 flex-row items-center gap-3 px-4 py-2 active:bg-subtle"
        >
          <SymbolView
            name={CHECK_ICON[check.status]}
            size={16}
            tintColor={colorFor(check.status)}
            type="monochrome"
          />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={2} className="text-sm text-foreground">
              {check.name}
            </Text>
            {check.description ? (
              <Text numberOfLines={1} className="text-xs text-foreground-muted">
                {check.description}
              </Text>
            ) : null}
          </View>
          <Text className="text-xs text-foreground-tertiary">
            {CHECK_STATUS_LABEL[check.status]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function labelColor(color: string | null) {
  return color && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null;
}

function MetaRow(props: { icon: AppSymbolName; title: string; children: ReactNode }) {
  const iconColor = String(useUniwindTheme()["--color-icon-muted"]);
  return (
    <View className="min-h-10 flex-row items-start gap-2 py-1.5">
      <View className="w-24 flex-row items-center gap-1.5 pt-1">
        <SymbolView name={props.icon} size={14} tintColor={iconColor} type="monochrome" />
        <Text className="text-[13px] text-foreground-muted">{props.title}</Text>
      </View>
      <View className="min-w-0 flex-1">{props.children}</View>
    </View>
  );
}

const VERDICT_LABEL = {
  approved: "Approved",
  "changes-requested": "Changes requested",
  dismissed: "Dismissed",
} as const;

/** A reviewer's face and name, with their verdict on the chip the way desktop rings the avatar. */
function ReviewerChip(props: {
  login: string;
  avatarUrl: string | null;
  outcome: keyof typeof VERDICT_LABEL | null;
  stale: boolean;
}) {
  const colorFor = useChecksToneColor();
  const verdictColor =
    props.outcome === "approved"
      ? colorFor("success")
      : props.outcome === "changes-requested"
        ? colorFor("failure")
        : null;
  const verdict = props.outcome
    ? `${VERDICT_LABEL[props.outcome]}${props.stale ? " before the latest commits" : ""}`
    : "Review requested";
  return (
    <View
      accessible
      accessibilityLabel={`${props.login}, ${verdict}`}
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5",
        props.stale && "opacity-60",
      )}
      style={verdictColor ? { borderColor: verdictColor } : undefined}
    >
      {props.avatarUrl ? (
        <Image
          source={{ uri: props.avatarUrl }}
          style={{ width: 20, height: 20, borderRadius: 10 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="size-5 items-center justify-center rounded-full bg-subtle-strong">
          <Text className="text-[10px] font-t3-bold text-foreground-secondary">
            {props.login.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <Text className="text-xs text-foreground">{props.login}</Text>
      {verdictColor ? (
        <SymbolView
          name={props.outcome === "approved" ? "checkmark.circle" : "xmark.circle"}
          size={13}
          tintColor={verdictColor}
          type="monochrome"
        />
      ) : null}
    </View>
  );
}

/**
 * The desktop Summary: who reviews it and how it is labelled up top, then the description open and
 * the checks folded behind their one-line summary. The conversation is the Timeline tab.
 */
export function PullRequestSummaryTab(props: {
  pr: PullRequestDetail;
  activity: PullRequestActivity | null;
  sections: PullRequestSummarySections;
  onSectionsChange: (next: PullRequestSummarySections) => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Opens a link in the description, natively when it names a pull request. */
  onLinkPress: (href: string) => void;
}) {
  const { pr, sections } = props;
  const insets = useSafeAreaInsets();
  const refreshColor = String(useUniwindTheme()["--color-icon"]);
  const reviewers = pullRequestReviewerEntries(
    props.activity?.reviewers ?? pr.reviewers,
    props.activity?.comments ?? [],
    props.activity?.commits ?? [],
  );
  const mergeLabel =
    pr.state === "merged"
      ? "Merged"
      : pr.state === "closed"
        ? "Closed without merging"
        : pr.mergeability === "conflicting"
          ? "Has merge conflicts"
          : pr.mergeability === "mergeable"
            ? "No conflicts"
            : "Not determined yet";
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={
        <RefreshControl
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          tintColor={refreshColor}
        />
      }
    >
      <View className="px-4 py-2">
        <MetaRow icon="person.2" title="Reviewers">
          {reviewers.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {reviewers.map((entry) => (
                <ReviewerChip
                  key={entry.key}
                  login={entry.actor?.login ?? "ghost"}
                  avatarUrl={entry.actor?.avatarUrl ?? null}
                  outcome={entry.outcome}
                  stale={entry.stale}
                />
              ))}
            </View>
          ) : (
            <Text className="pt-1 text-[13px] text-foreground-muted">None</Text>
          )}
        </MetaRow>
        {pr.labels.length > 0 ? (
          <MetaRow icon="ticket" title="Labels">
            <View className="flex-row flex-wrap gap-1.5">
              {pr.labels.map((label) => {
                const color = labelColor(label.color);
                return (
                  <View
                    key={label.name}
                    className="flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5"
                  >
                    {color ? (
                      <View className="size-2 rounded-full" style={{ backgroundColor: color }} />
                    ) : null}
                    <Text className="text-xs text-foreground-secondary">{label.name}</Text>
                  </View>
                );
              })}
            </View>
          </MetaRow>
        ) : null}
        <MetaRow icon="arrow.triangle.merge" title="Merge">
          <Text
            className={cn(
              "pt-1 text-[13px]",
              pr.state === "open" && pr.mergeability === "conflicting"
                ? "text-danger-foreground"
                : "text-foreground",
            )}
          >
            {mergeLabel}
          </Text>
        </MetaRow>
      </View>
      <Section
        title="Description"
        open={sections.description}
        onToggle={() => props.onSectionsChange({ ...sections, description: !sections.description })}
      >
        {pr.body.trim() ? (
          <FileMarkdownPreview embedded markdown={pr.body} onLinkPress={props.onLinkPress} />
        ) : (
          <Text className="px-4 text-sm italic text-foreground-muted">
            No description provided.
          </Text>
        )}
      </Section>
      <Section
        title="Checks"
        detail={<ChecksSummary checks={pr.checks} />}
        open={sections.checks}
        onToggle={() => props.onSectionsChange({ ...sections, checks: !sections.checks })}
      >
        <Checks checks={pr.checks} />
      </Section>
    </ScrollView>
  );
}
