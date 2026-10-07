import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type PullRequestDetail,
  type PullRequestRef,
} from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  gitHubPullRequestBrowserUrl,
  parseChangeRequestUrl,
} from "@t3tools/shared/changeRequestUrl";
import { allowsSinglePullRequestMerge } from "@t3tools/shared/pullRequestHandoff";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { MenuAction } from "@react-native-menu/menu";
import { Image } from "expo-image";
import { type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, useColorScheme, View } from "react-native";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { ControlPillMenu } from "../../components/ControlPill";
import { relativeTime } from "../../lib/time";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { useProject } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { pullRequestEnvironment, pullRequestStack } from "../../state/pull-requests";
import { serverEnvironment } from "../../state/server";
import {
  allowedMergeMethods,
  pullRequestMenuGroups,
  type PullRequestMenuCommand,
  type PullRequestMenuItem,
} from "./pull-request-actions";
import {
  describePullRequestFailure,
  pullRequestFailureMessage,
  resolvePullRequestPresentation,
} from "./pull-request-model";
import { PrButton, PrNotice, PrStateMessage, PrTabs } from "./pull-request-components";
import { PullRequestCode } from "./PullRequestCode";
import {
  DEFAULT_PULL_REQUEST_SUMMARY_SECTIONS,
  PullRequestSummaryTab,
  type PullRequestSummarySections,
} from "./PullRequestSummaryTab";
import { PullRequestTimelineTab } from "./PullRequestTimelineTab";
import { useOpenPullRequest } from "./useOpenPullRequest";
import { usePullRequestComposer } from "./usePullRequestComposer";
import {
  type PullRequestActionStatus,
  usePullRequestDetailActions,
} from "./usePullRequestDetailActions";

type DetailTab = "summary" | "timeline" | "code";

/**
 * The route a pull request link opens: that pull request alone, at every width, with Back
 * returning to wherever the link was. `threadId` names the thread it was opened from, which is
 * where hand-offs land and what Unlink acts on. The list of pull requests is its own screen.
 */
export function PullRequestDetailScreen(
  props: StaticScreenProps<{
    environmentId: string;
    projectId: string;
    repository: string;
    number: number;
    host?: string;
    threadId?: string;
  }>,
) {
  const navigation = useNavigation();
  const params = props.route.params;
  const reference = useMemo<PullRequestRef>(
    () => ({
      projectId: ProjectId.make(params.projectId),
      repository: params.repository,
      number: Number(params.number),
      ...(params.host ? { host: params.host } : {}),
    }),
    [params.host, params.number, params.projectId, params.repository],
  );
  return (
    <View className="flex-1 bg-header">
      <PullRequestDetailPane
        environmentId={EnvironmentId.make(params.environmentId)}
        reference={reference}
        originThreadId={params.threadId ? ThreadId.make(params.threadId) : null}
        onBack={() => navigation.goBack()}
      />
    </View>
  );
}

/**
 * One pull request: the desktop header (state, title, author, branches, size), native tabs, and
 * the rest of the screen for content. On a phone, `onBack` is set and the header takes over the
 * top bar, so there is no second bar above it; beside the list there is no back control and the
 * list's own header stays on top.
 */
export function PullRequestDetailPane(props: {
  environmentId: EnvironmentId;
  reference: PullRequestRef;
  originThreadId?: ThreadId | null;
  onBack?: (() => void) | undefined;
}) {
  const registry = useContext(RegistryContext);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [sections, setSections] = useState<PullRequestSummarySections>(
    DEFAULT_PULL_REQUEST_SUMMARY_SECTIONS,
  );
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState(0);
  const target = { environmentId: props.environmentId, input: props.reference };
  const detail = useEnvironmentQuery(pullRequestEnvironment.detail(target));
  // Read with the detail, as the desktop does: the reviewers' verdicts and the findings a
  // hand-off carries come from here, not only the Timeline tab.
  const activity = useEnvironmentQuery(pullRequestEnvironment.activity(target));
  const invalidate = useAtomCommand(pullRequestEnvironment.invalidate, { reportFailure: false });
  const { refresh: refreshDetail } = detail;
  const { refresh: refreshActivity } = activity;
  const openLink = useOpenPullRequest();
  const originThreadId = props.originThreadId ?? null;
  // A link in a description or comment opens in the viewer when it names a pull request this
  // environment can read, so following one never drops the reader into the GitHub app. The
  // originating thread travels with it, so a nested pull request can still hand off there.
  const onLinkPress = useCallback(
    (href: string) =>
      void openLink(
        href,
        String(props.environmentId),
        "markdown-link",
        originThreadId === null ? undefined : String(originThreadId),
      ),
    [openLink, props.environmentId, originThreadId],
  );
  const project = useProject(scopeProjectRef(props.environmentId, props.reference.projectId));
  // Offered where the host's own page may still load when this one cannot.
  const hostUrl = gitHubPullRequestBrowserUrl(
    project?.repositoryIdentity,
    props.reference.repository,
    props.reference.number,
  );

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await invalidate({
        environmentId: props.environmentId,
        input: { reference: props.reference },
      });
      if (result._tag === "Failure") {
        const failure = squashAtomCommandFailure(result);
        setRefreshError(
          pullRequestFailureMessage(
            failure instanceof Error ? failure.message : "Could not refresh the pull request.",
          ),
        );
      }
      // The reads run either way: at worst they answer from the server's cache.
      refreshDetail();
      refreshActivity();
      registry.refresh(
        pullRequestEnvironment.diff({ environmentId: props.environmentId, input: props.reference }),
      );
      setDiffVersion((value) => value + 1);
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
  const actions = usePullRequestDetailActions({
    environmentId: props.environmentId,
    reference: props.reference,
    detail: pr,
    activity: activity.data,
    originThreadId,
    refreshFromHost: refresh,
  });
  const canMergeSingle = useCanMergeSinglePullRequest(props.environmentId, props.reference, pr);

  if (!pr) {
    return (
      <PaneBar
        onBack={props.onBack}
        repository={props.reference.repository}
        number={props.reference.number}
      >
        {detail.error ? (
          <PrStateMessage
            icon="arrow.triangle.pull"
            {...describePullRequestFailure({
              failure: detail.failure,
              message: detail.error,
              number: props.reference.number,
            })}
          >
            <PrButton
              label="Retry"
              icon="arrow.clockwise"
              busy={detail.isPending}
              onPress={detail.refresh}
            />
            {hostUrl ? (
              <PrButton
                label="Open on GitHub"
                icon="safari"
                onPress={() => void tryOpenExternalUrl(hostUrl, "pull-request")}
              />
            ) : null}
          </PrStateMessage>
        ) : (
          <PrStateMessage icon="arrow.triangle.pull" title="Loading pull request" loading />
        )}
      </PaneBar>
    );
  }

  const verdicts = pr.capabilities.review.verdicts.filter((verdict) =>
    pr.viewerPermissions.verdicts.includes(verdict),
  );
  const canComment = pr.capabilities.comment && pr.viewerPermissions.comment;
  const compact = tab === "code";
  const failureLine =
    refreshError ?? (detail.error ? pullRequestFailureMessage(detail.error) : null);
  const notices = failureLine === null ? [] : [`${failureLine} Showing the last loaded details.`];
  const methods = allowedMergeMethods(pr);
  const menu = pullRequestMenuGroups({
    detail: pr,
    thread: actions.thread,
    canMergeSingle,
    mergeMethod: pr.autoMergeMethod ?? methods[0] ?? "merge",
    refreshing,
    actionPending: actions.pendingAction !== null || actions.linkPending,
    handoffPending: actions.handoffPending || activity.isPending,
  });
  const menuButton = (
    <PullRequestMenu
      groups={menu}
      busy={
        refreshing ||
        actions.pendingAction !== null ||
        actions.linkPending ||
        actions.handoffPending
      }
      onCommand={actions.run}
    />
  );
  return (
    <PaneBar onBack={props.onBack} repository={pr.repository} number={pr.number} menu={menuButton}>
      <View className="gap-1.5 px-4 pb-3">
        <StatePill pr={pr} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pr.title}
          accessibilityHint={titleExpanded ? "Collapse the title" : "Show the full title"}
          onPress={() => setTitleExpanded((value) => !value)}
        >
          <Text
            numberOfLines={titleExpanded ? undefined : compact ? 1 : 3}
            className="text-[18px] font-t3-bold leading-6 text-foreground"
          >
            {pr.title}
          </Text>
        </Pressable>
        {compact ? null : <HeaderFacts pr={pr} />}
      </View>
      <ActionStatus status={actions.status} onDismiss={actions.dismissStatus} />
      <PrTabs
        tabs={[
          { key: "summary", label: "Summary" },
          { key: "timeline", label: "Timeline", badge: activity.data?.commentCount },
          ...(pr.capabilities.diff
            ? [{ key: "code" as const, label: "Code", badge: pr.changedFiles }]
            : []),
        ]}
        selected={tab}
        onSelect={setTab}
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
        <PullRequestSummaryTab
          pr={pr}
          activity={activity.data}
          sections={sections}
          onSectionsChange={setSections}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          onLinkPress={onLinkPress}
        />
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
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          onLinkPress={onLinkPress}
        />
      )}
    </PaneBar>
  );
}

/**
 * The desktop's single-merge guard. A host that keeps stacks merges a stacked pull request from
 * its stack, so a single merge is offered only once the host has said this one is not in one.
 */
function useCanMergeSinglePullRequest(
  environmentId: EnvironmentId,
  reference: PullRequestRef,
  pr: PullRequestDetail | null,
) {
  const capabilities = useAtomValue(
    serverEnvironment.configValueAtom(environmentId),
    (config) => config?.environment.capabilities,
  );
  const supportsStackActions =
    capabilities?.threadPullRequests === true &&
    capabilities.pullRequestStackActions === true &&
    pr?.capabilities.stacks === true &&
    pr.capabilities.stackActions === true;
  const stack = useEnvironmentQuery(
    pr && supportsStackActions
      ? pullRequestStack({
          environmentId,
          input: { ...reference, host: reference.host ?? parseChangeRequestUrl(pr.url)?.host },
        })
      : null,
  );
  return allowsSinglePullRequestMerge({
    supportsStackActions,
    hasStack: stack.data !== null,
    stackPending: stack.isPending,
    stackError: stack.error,
  });
}

/** The three-dot menu: grouped natively on iOS, a flat Material list on Android. */
function PullRequestMenu(props: {
  groups: PullRequestMenuItem[][];
  busy: boolean;
  onCommand: (command: PullRequestMenuCommand) => void;
}) {
  const iconColor = String(useUniwindTheme()["--color-header-foreground"]);
  const toAction = (item: PullRequestMenuItem): MenuAction => ({
    id: item.id,
    title: item.title,
    ...(item.subtitle ? { subtitle: item.subtitle } : {}),
    ...(Platform.OS === "ios"
      ? { image: typeof item.icon === "string" ? item.icon : item.icon.ios }
      : {}),
    attributes: { disabled: item.disabled ?? false, destructive: item.destructive ?? false },
  });
  const actions =
    Platform.OS === "ios"
      ? props.groups.map((group, index): MenuAction => ({
          id: `group:${index}`,
          title: "",
          displayInline: true,
          subactions: group.map(toAction),
        }))
      : props.groups.flat().map(toAction);
  return (
    <ControlPillMenu
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        const item = props.groups.flat().find((entry) => entry.id === nativeEvent.event);
        if (item && !item.disabled) props.onCommand(item.command);
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="More pull request actions"
        accessibilityState={{ busy: props.busy }}
        className="size-11 items-center justify-center rounded-full"
      >
        {props.busy ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <SymbolView name="ellipsis" size={20} tintColor={iconColor} type="monochrome" />
        )}
      </View>
    </ControlPillMenu>
  );
}

/** How the last menu action went, in place of a toast: a failure stays until dismissed. */
function ActionStatus(props: { status: PullRequestActionStatus | null; onDismiss: () => void }) {
  const iconColor = String(useUniwindTheme()["--color-icon-muted"]);
  const { status } = props;
  if (status === null) return null;
  if (status.tone === "failure") {
    return (
      <PrNotice
        lines={status.detail ? [status.title, status.detail] : [status.title]}
        actionLabel="Dismiss"
        onAction={props.onDismiss}
      />
    );
  }
  return (
    <View
      accessibilityLiveRegion="polite"
      className="mx-4 mb-2 flex-row items-center gap-2 rounded-lg bg-subtle px-3 py-2"
    >
      {status.tone === "progress" ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <SymbolView name="checkmark.circle" size={15} tintColor={iconColor} type="monochrome" />
      )}
      <Text className="min-w-0 flex-1 text-[13px] text-foreground-secondary">{status.title}</Text>
      {status.tone === "success" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={12}
          onPress={props.onDismiss}
        >
          <SymbolView name="xmark" size={14} tintColor={iconColor} type="monochrome" />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatePill(props: {
  pr: Pick<PullRequestDetail, "state" | "isDraft" | "mergeability" | "url">;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const presentation = resolvePullRequestPresentation(props.pr, scheme);
  return (
    <View className="flex-row">
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
    </View>
  );
}

/**
 * The pane's frame. On a phone it is the app's own top bar (back, `#number` over the repository,
 * the action menu) above the rounded content surface every screen uses; beside the list it is a
 * slim bar inside the list's surface with the menu rightmost.
 */
function PaneBar(props: {
  onBack?: (() => void) | undefined;
  repository: string;
  number: number;
  menu?: ReactNode;
  children: ReactNode;
}) {
  if (props.onBack) {
    return (
      <View className="flex-1 bg-header">
        <AndroidScreenHeader
          title={`#${props.number}`}
          subtitle={props.repository}
          onBack={props.onBack}
          hideBottomBorder
          trailing={props.menu}
        />
        <View className="flex-1 overflow-hidden rounded-t-[28px] bg-screen pt-4">
          {props.children}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-screen">
      <View className="min-h-12 flex-row items-center gap-1 pl-4 pr-1 pt-1">
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          className="min-w-0 flex-1 text-[13px] text-foreground-muted"
        >
          {props.repository} #{props.number}
        </Text>
        {props.menu}
      </View>
      {props.children}
    </View>
  );
}

/**
 * Who and when, which branches, and how big: the desktop header's line, with the base first and
 * the head it receives changes from after it. Split in two so neither wraps on a phone.
 */
function HeaderFacts(props: {
  pr: Pick<
    PullRequestDetail,
    | "author"
    | "headBranch"
    | "baseBranch"
    | "updatedAt"
    | "additions"
    | "deletions"
    | "changedFiles"
  >;
}) {
  const { pr } = props;
  const iconColor = String(useUniwindTheme()["--color-icon-muted"]);
  const login = pr.author?.login ?? "ghost";
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        {pr.author?.avatarUrl ? (
          <Image
            source={{ uri: pr.author.avatarUrl }}
            style={{ width: 18, height: 18, borderRadius: 9 }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text numberOfLines={1} className="min-w-0 shrink text-[13px] text-foreground-muted">
          <Text className="text-[13px] font-t3-medium text-foreground-secondary">{login}</Text>
          {` · updated ${relativeTime(pr.updatedAt)}`}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View
          accessible
          accessibilityLabel={`${pr.baseBranch} receives changes from ${pr.headBranch}`}
          className="min-w-0 flex-1 flex-row items-center gap-1"
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            className="max-w-[45%] shrink-0 rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-foreground-secondary"
          >
            {pr.baseBranch}
          </Text>
          <SymbolView name="arrow.left" size={12} tintColor={iconColor} type="monochrome" />
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            className="min-w-0 shrink rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-foreground-secondary"
          >
            {pr.headBranch}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={`${pr.changedFiles} changed ${pr.changedFiles === 1 ? "file" : "files"}, ${pr.additions} additions, ${pr.deletions} deletions`}
          className="flex-row items-center gap-1.5"
        >
          <SymbolView name="doc.text" size={12} tintColor={iconColor} type="monochrome" />
          <Text className="font-mono text-[11px] text-foreground-muted">{pr.changedFiles}</Text>
          <Text className="font-mono text-[11px] text-primary-text">+{pr.additions}</Text>
          <Text className="font-mono text-[11px] text-danger-foreground">-{pr.deletions}</Text>
        </View>
      </View>
    </View>
  );
}
