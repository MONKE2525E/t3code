import type { PullRequestDetail } from "@t3tools/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, RefreshControl, ScrollView, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type AppSymbolName, SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { FileMarkdownPreview } from "../files/FileMarkdownPreview";
import {
  sortPullRequestChecks,
  summarizePullRequestChecks,
  type PullRequestChecksTone,
} from "./pull-request-model";

const COLLAPSED_CHECK_COUNT = 5;

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

function SectionTitle(props: { title: string; detail?: string }) {
  return (
    <View className="flex-row items-baseline gap-2 px-4 pb-1.5 pt-5">
      <Text className="text-xs font-t3-bold text-foreground-muted">{props.title}</Text>
      {props.detail ? (
        <Text className="text-xs text-foreground-tertiary">{props.detail}</Text>
      ) : null}
    </View>
  );
}

function Checks(props: { checks: PullRequestDetail["checks"] }) {
  const [expanded, setExpanded] = useState(false);
  const colorFor = useChecksToneColor();
  const summary = summarizePullRequestChecks(props.checks);
  const sorted = sortPullRequestChecks(props.checks);
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_CHECK_COUNT);
  return (
    <>
      <SectionTitle title="Checks" detail={summary.label} />
      <View>
        {visible.map((check) => (
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
              <Text numberOfLines={1} className="text-sm text-foreground">
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
        {sorted.length > COLLAPSED_CHECK_COUNT ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((value) => !value)}
            className="min-h-11 justify-center px-4"
          >
            <Text className="text-sm font-t3-medium text-foreground-secondary">
              {expanded ? "Show fewer" : `Show all ${sorted.length}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function labelColor(color: string | null) {
  return color && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null;
}

function MetaRow(props: { title: string; children: ReactNode }) {
  return (
    <View className="min-h-11 flex-row items-start gap-3 px-4 py-2.5">
      <Text className="w-20 pt-px text-sm text-foreground-muted">{props.title}</Text>
      <View className="min-w-0 flex-1">{props.children}</View>
    </View>
  );
}

/**
 * Description first, because it is what the author wrote for the reader, then the facts a
 * reviewer acts on: checks, who was asked, labels and whether it can merge.
 */
export function PullRequestSummaryTab(props: {
  pr: PullRequestDetail;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { pr } = props;
  const insets = useSafeAreaInsets();
  const refreshColor = String(useUniwindTheme()["--color-icon"]);
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
      {pr.body.trim() ? (
        <FileMarkdownPreview embedded markdown={pr.body} />
      ) : (
        <Text className="px-4 pt-4 text-sm text-foreground-muted">No description provided.</Text>
      )}
      <View className="mx-4 mt-2 h-px bg-border" />
      {pr.checks.length > 0 ? <Checks checks={pr.checks} /> : null}
      <SectionTitle title="Details" />
      <MetaRow title="Merge">
        <Text
          className={
            pr.state === "open" && pr.mergeability === "conflicting"
              ? "text-sm text-danger-foreground"
              : "text-sm text-foreground"
          }
        >
          {mergeLabel}
        </Text>
      </MetaRow>
      <MetaRow title="Reviewers">
        <Text className="text-sm text-foreground">
          {pr.reviewers.length > 0
            ? pr.reviewers.map((actor) => actor.login).join(", ")
            : "None requested"}
        </Text>
      </MetaRow>
      <MetaRow title="Labels">
        {pr.labels.length > 0 ? (
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
        ) : (
          <Text className="text-sm text-foreground">None</Text>
        )}
      </MetaRow>
    </ScrollView>
  );
}
