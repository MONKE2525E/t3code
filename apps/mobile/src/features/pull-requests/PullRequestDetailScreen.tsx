import { type EnvironmentId, type PullRequestRef } from "@t3tools/contracts";
import { type StaticScreenProps } from "@react-navigation/native";
import { RegistryContext } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { useCallback, useContext, useState } from "react";
import { Pressable, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { relativeTime } from "../../lib/time";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { pullRequestEnvironment } from "../../state/pull-requests";
import { resolvePullRequestPresentation, summarizePullRequestChecks } from "./pull-request-model";
import {
  PrButton,
  PrIconButton,
  PrNotice,
  PrStateMessage,
  PrTabs,
} from "./pull-request-components";
import { PullRequestCode } from "./PullRequestCode";
import { PullRequestsScreen } from "./PullRequestsScreen";
import { PullRequestSummaryTab, useChecksToneColor } from "./PullRequestSummaryTab";
import { PullRequestTimelineTab } from "./PullRequestTimelineTab";
import { usePullRequestComposer } from "./usePullRequestComposer";

type DetailTab = "summary" | "timeline" | "code";

export function PullRequestDetailScreen(
  props: StaticScreenProps<{
    environmentId: string;
    projectId: string;
    repository: string;
    number: number;
  }>,
) {
  return <PullRequestsScreen route={props.route} />;
}

/**
 * One pull request: a compact header, native tabs, and the rest of the screen for content. On a
 * phone, `onBack` is set and the header takes over the top bar, so there is no second bar above
 * it; beside the list there is no back control and the list's own header stays on top.
 */
export function PullRequestDetailPane(props: {
  environmentId: EnvironmentId;
  reference: PullRequestRef;
  onBack?: (() => void) | undefined;
}) {
  const registry = useContext(RegistryContext);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DetailTab>("summary");
  const [timelineSeen, setTimelineSeen] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState(0);
  const target = { environmentId: props.environmentId, input: props.reference };
  const detail = useEnvironmentQuery(pullRequestEnvironment.detail(target));
  const activity = useEnvironmentQuery(
    tab === "timeline" || timelineSeen ? pullRequestEnvironment.activity(target) : null,
  );
  const invalidate = useAtomCommand(pullRequestEnvironment.invalidate, { reportFailure: false });
  const { refresh: refreshDetail } = detail;
  const { refresh: refreshActivity } = activity;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await invalidate({
        environmentId: props.environmentId,
        input: { reference: props.reference },
      });
      if (result._tag === "Success") {
        refreshDetail();
        refreshActivity();
        registry.refresh(
          pullRequestEnvironment.diff({
            environmentId: props.environmentId,
            input: props.reference,
          }),
        );
        setDiffVersion((value) => value + 1);
      } else {
        const failure = squashAtomCommandFailure(result);
        setRefreshError(
          failure instanceof Error
            ? failure.message
            : "Could not refresh the pull request. Try again.",
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  const onPosted = useCallback(() => {
    refreshDetail();
    refreshActivity();
  }, [refreshActivity, refreshDetail]);
  const composer = usePullRequestComposer({
    environmentId: props.environmentId,
    reference: props.reference,
    onPosted,
  });

  const pr = detail.data;
  const topInset = props.onBack ? Math.max(insets.top, 12) : 0;
  const selectTab = (next: DetailTab) => {
    if (next === "timeline") setTimelineSeen(true);
    setTab(next);
  };

  if (!pr) {
    return (
      <View className="flex-1 bg-screen">
        <PaneBar
          onBack={props.onBack}
          topInset={topInset}
          repository={props.reference.repository}
          number={props.reference.number}
        />
        {detail.error ? (
          <PrStateMessage
            icon="arrow.triangle.pull"
            title="Could not load this pull request"
            message={detail.error}
          >
            <PrButton label="Retry" icon="arrow.clockwise" onPress={detail.refresh} />
          </PrStateMessage>
        ) : (
          <PrStateMessage icon="arrow.triangle.pull" title="Loading pull request" loading />
        )}
      </View>
    );
  }

  const verdicts = pr.capabilities.review.verdicts.filter((verdict) =>
    pr.viewerPermissions.verdicts.includes(verdict),
  );
  const canComment = pr.capabilities.comment && pr.viewerPermissions.comment;
  const compact = tab === "code";
  const notices = [refreshError ?? detail.error].filter((line): line is string => line !== null);
  return (
    <View className="flex-1 bg-screen">
      <PaneBar
        onBack={props.onBack}
        topInset={topInset}
        repository={pr.repository}
        number={pr.number}
        pr={pr}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pr.title}
        accessibilityHint={titleExpanded ? "Collapse the title" : "Show the full title"}
        onPress={() => setTitleExpanded((value) => !value)}
        className="px-4 pb-1"
      >
        <Text
          numberOfLines={titleExpanded ? undefined : compact ? 1 : 3}
          className="text-[17px] font-t3-bold leading-6 text-foreground"
        >
          {pr.title}
        </Text>
      </Pressable>
      {compact ? null : <HeaderFacts pr={pr} />}
      <View className="mt-2" />
      <PrTabs
        tabs={[
          { key: "summary", label: "Summary" },
          { key: "timeline", label: "Timeline", badge: activity.data?.commentCount },
          ...(pr.capabilities.diff
            ? [{ key: "code" as const, label: "Code", badge: pr.changedFiles }]
            : []),
        ]}
        selected={tab}
        onSelect={selectTab}
      />
      {notices.length > 0 ? (
        <View className="pt-2">
          <PrNotice
            lines={notices}
            actionLabel="Retry"
            onAction={() => (refreshError ? void refresh() : detail.refresh())}
          />
        </View>
      ) : null}
      {tab === "summary" ? (
        <PullRequestSummaryTab pr={pr} refreshing={refreshing} onRefresh={() => void refresh()} />
      ) : tab === "code" ? (
        <PullRequestCode
          key={diffVersion}
          environmentId={props.environmentId}
          reference={props.reference}
        />
      ) : (
        <PullRequestTimelineTab
          activity={activity}
          composer={composer}
          canComment={canComment}
          verdicts={verdicts}
          target={`${pr.repository}#${pr.number}`}
        />
      )}
    </View>
  );
}

/** Back, state, where this is, and the two actions that apply to any pull request. */
function PaneBar(props: {
  onBack?: (() => void) | undefined;
  topInset: number;
  repository: string;
  number: number;
  pr?: {
    state: "open" | "closed" | "merged";
    isDraft: boolean;
    mergeability: "mergeable" | "conflicting" | "unknown";
    url: string;
  };
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const iconColor = String(useUniwindTheme()["--color-icon"]);
  const presentation = props.pr ? resolvePullRequestPresentation(props.pr, scheme) : null;
  return (
    <View style={{ paddingTop: props.topInset }}>
      <View className="min-h-12 flex-row items-center gap-1 pl-1 pr-1">
        {props.onBack ? (
          <Pressable
            accessibilityLabel="Navigate up"
            accessibilityRole="button"
            hitSlop={8}
            onPress={props.onBack}
            className="size-11 items-center justify-center"
          >
            <SymbolView name="chevron.left" size={22} tintColor={iconColor} type="monochrome" />
          </Pressable>
        ) : (
          <View className="w-3" />
        )}
        {presentation ? (
          <View
            accessibilityLabel={`Status: ${presentation.label}`}
            className="flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          >
            <SymbolView
              name={presentation.icon}
              size={13}
              tintColor={presentation.color}
              type="monochrome"
            />
            <Text className="text-xs font-t3-bold" style={{ color: presentation.color }}>
              {presentation.label}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          className="ml-1.5 min-w-0 flex-1 text-[13px] text-foreground-muted"
        >
          {props.repository} #{props.number}
        </Text>
        {props.pr ? (
          <>
            <PrIconButton
              icon="arrow.clockwise"
              label="Refresh pull request"
              busy={props.refreshing}
              onPress={() => props.onRefresh?.()}
            />
            <PrIconButton
              icon="safari"
              label="Open on host"
              onPress={() => void tryOpenExternalUrl(props.pr!.url, "pull-request")}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Who, which branches, and what changed, in two lines that wrap instead of growing the header. */
function HeaderFacts(props: {
  pr: {
    author: { login: string } | null;
    headBranch: string;
    baseBranch: string;
    updatedAt: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    checks: Parameters<typeof summarizePullRequestChecks>[0];
  };
}) {
  const { pr } = props;
  const colorFor = useChecksToneColor();
  const checks = summarizePullRequestChecks(pr.checks);
  return (
    <View className="gap-1 px-4">
      <Text numberOfLines={1} className="text-[13px] text-foreground-muted">
        <Text className="text-[13px] font-t3-medium text-foreground-secondary">
          {pr.author?.login ?? "ghost"}
        </Text>
        {"  "}
        <Text className="font-mono text-xs">
          {pr.headBranch} → {pr.baseBranch}
        </Text>
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
        {checks.tone === "none" ? null : (
          <View className="flex-row items-center gap-1">
            <SymbolView
              name={
                checks.tone === "success"
                  ? "checkmark.circle"
                  : checks.tone === "failure"
                    ? "xmark.circle"
                    : "clock"
              }
              size={13}
              tintColor={colorFor(checks.tone)}
              type="monochrome"
            />
            <Text className="text-xs text-foreground-muted">{checks.label}</Text>
          </View>
        )}
        <Text className="text-xs">
          <Text className="text-xs text-primary-text">+{pr.additions}</Text>
          <Text className="text-xs text-foreground-tertiary"> </Text>
          <Text className="text-xs text-danger-foreground">-{pr.deletions}</Text>
          <Text className="text-xs text-foreground-muted">
            {" "}
            in {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
          </Text>
        </Text>
        <Text className="text-xs text-foreground-tertiary">
          updated {relativeTime(pr.updatedAt)}
        </Text>
      </View>
    </View>
  );
}
