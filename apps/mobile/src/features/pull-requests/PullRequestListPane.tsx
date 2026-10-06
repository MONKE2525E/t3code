import {
  type EnvironmentId,
  ProjectId,
  type PullRequestListCursors,
  type PullRequestListEntry,
  type PullRequestRef,
} from "@t3tools/contracts";
import type { MenuAction } from "@react-native-menu/menu";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ControlPillMenu } from "../../components/ControlPill";
import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/time";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { useEnvironmentQuery } from "../../state/query";
import { pullRequestEnvironment } from "../../state/pull-requests";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  countActivePullRequestFilters,
  DEFAULT_PULL_REQUEST_FILTERS,
  matchesPullRequestQuery,
  mergePullRequestPages,
  PULL_REQUEST_SORT_OPTIONS,
  type PullRequestFilters,
  pullRequestRowKey,
  resolvePullRequestListStatus,
  resolvePullRequestNotices,
  resolvePullRequestPresentation,
  sortPullRequests,
} from "./pull-request-model";
import { PrButton, PrNotice, PrStateMessage, PrToolbarButton } from "./pull-request-components";
import { PullRequestFiltersSheet } from "./PullRequestFiltersSheet";

const PAGE_SIZE = 50;
const MAX_LIMIT = 500;
const SEARCH_DEBOUNCE_MS = 300;

interface Paging {
  /** The scope this paging belongs to; paging from another scope is ignored, not carried over. */
  readonly scope: string;
  readonly cursors: PullRequestListCursors | undefined;
  readonly previousPages: ReadonlyArray<ReadonlyArray<PullRequestListEntry>>;
  readonly limit: number;
}

function initialPaging(scope: string): Paging {
  return { scope, cursors: undefined, previousPages: [], limit: PAGE_SIZE };
}

/**
 * Search, the Sort / Filters / environment toolbar and the list itself. Paging is tagged with the
 * scope it was read for, so a changed filter starts from the first page while the search field
 * and its focus stay where they are.
 */
export function PullRequestListPane(props: {
  environmentId: EnvironmentId;
  environments: ReadonlyArray<{
    readonly environmentId: string;
    readonly environmentLabel: string;
  }>;
  onEnvironmentChange: (environmentId: string) => void;
  projects: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  filters: PullRequestFilters;
  onFiltersChange: (patch: Partial<PullRequestFilters>) => void;
  selected: PullRequestRef | null;
  onSelect: (entry: PullRequestListEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const { filters } = props;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scope = JSON.stringify([
    props.environmentId,
    filters.projectId,
    filters.state,
    filters.involvement,
    query,
  ]);
  const [storedPaging, setPaging] = useState<Paging>(() => initialPaging(scope));
  const paging = storedPaging.scope === scope ? storedPaging : initialPaging(scope);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const invalidate = useAtomCommand(pullRequestEnvironment.invalidate);
  const listing = useEnvironmentQuery(
    pullRequestEnvironment.list({
      environmentId: props.environmentId,
      input: {
        state: filters.state,
        involvement: filters.involvement,
        limit: paging.limit,
        ...(filters.projectId ? { projectId: ProjectId.make(filters.projectId) } : {}),
        ...(query ? { query } : {}),
        ...(paging.cursors ? { cursors: paging.cursors } : {}),
      },
    }),
  );
  const data = listing.data;
  const entries = useMemo(
    () =>
      sortPullRequests(
        mergePullRequestPages([...paging.previousPages, data?.entries ?? []]).filter((entry) => {
          const provider = data?.providers.find((item) => item.host === entry.host);
          return provider?.searchesOnHost !== false || matchesPullRequestQuery(entry, query);
        }),
        filters.sort,
      ),
    [paging.previousPages, data, query, filters.sort],
  );
  const unavailable = useMemo(
    () => new Map((data?.errors ?? []).map((error) => [error.projectId as string, error.message])),
    [data],
  );
  const health = useMemo(
    () => ({
      error: listing.error,
      projectErrors: data?.errors ?? [],
      unconfigured: (data?.providers ?? []).filter((provider) => !provider.configured),
    }),
    [listing.error, data],
  );
  const filterCount = countActivePullRequestFilters(filters);
  const status = resolvePullRequestListStatus({
    rowCount: entries.length,
    hasData: data !== null && data !== undefined,
    pending: listing.isPending,
    query,
    filterCount,
    health,
  });

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // The server keeps its own answer for a while; ask it to forget before reading again, and
      // read again even if that fails so Retry never looks dead.
      await invalidate({ environmentId: props.environmentId, input: {} });
      setPaging(initialPaging(scope));
      listing.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!data?.truncated || listing.isPending) return;
    if (Object.keys(data.nextCursors).length > 0) {
      setPaging({
        ...paging,
        previousPages: [...paging.previousPages, data.entries],
        cursors: data.nextCursors,
      });
    } else if (paging.limit < MAX_LIMIT) {
      setPaging({ ...paging, limit: Math.min(paging.limit + PAGE_SIZE, MAX_LIMIT) });
    }
  }, [data, listing.isPending, paging]);
  const canLoadMore =
    data?.truncated === true &&
    (Object.keys(data.nextCursors).length > 0 || paging.limit < MAX_LIMIT);

  // A further page is on its way: the rows already read stay up and the footer says so.
  const loadingMore = listing.isPending && entries.length > 0;

  const sortActions = useMemo<MenuAction[]>(
    () =>
      PULL_REQUEST_SORT_OPTIONS.map((option) => ({
        id: `sort:${option.value}`,
        title: option.label,
        state: filters.sort === option.value ? "on" : "off",
      })),
    [filters.sort],
  );
  const environmentActions = useMemo<MenuAction[]>(
    () =>
      props.environments.map((environment) => ({
        id: `environment:${environment.environmentId}`,
        title: environment.environmentLabel,
        state: environment.environmentId === props.environmentId ? "on" : "off",
      })),
    [props.environments, props.environmentId],
  );
  const environmentLabel =
    props.environments.find((item) => item.environmentId === props.environmentId)
      ?.environmentLabel ?? "Environment";
  const sortLabel = PULL_REQUEST_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label;

  const clearSearch = () => {
    setSearch("");
    setQuery("");
  };
  const resetFilters = () =>
    props.onFiltersChange({
      state: DEFAULT_PULL_REQUEST_FILTERS.state,
      involvement: DEFAULT_PULL_REQUEST_FILTERS.involvement,
      projectId: undefined,
    });

  const notices = status.kind === "rows" ? resolvePullRequestNotices(health) : [];
  const body =
    status.kind === "rows" ? null : status.kind === "loading" ? (
      <ListSkeleton />
    ) : status.kind === "error" || status.kind === "setup" ? (
      <PrStateMessage icon="arrow.triangle.pull" title={status.title} message={status.message}>
        <PrButton
          label="Retry"
          icon="arrow.clockwise"
          busy={refreshing}
          onPress={() => void refresh()}
        />
      </PrStateMessage>
    ) : status.kind === "empty-search" ? (
      <PrStateMessage
        icon="magnifyingglass"
        title={`Nothing matches "${query.length > 40 ? `${query.slice(0, 40)}...` : query}"`}
        message="Try fewer words, or search by number, author or branch."
      >
        <PrButton label="Clear search" onPress={clearSearch} />
        <PrButton
          label="Check again"
          icon="arrow.clockwise"
          busy={refreshing}
          onPress={() => void refresh()}
        />
      </PrStateMessage>
    ) : (
      <PrStateMessage
        icon="arrow.triangle.pull"
        title={
          status.kind === "empty-filtered" ? "Nothing under these filters" : "No pull requests"
        }
        message={
          status.kind === "empty-filtered"
            ? "Widen the state, involvement or project to see more."
            : "Pull requests from this environment's projects appear here."
        }
      >
        {status.kind === "empty-filtered" ? (
          <PrButton label="Reset filters" onPress={resetFilters} />
        ) : null}
        <PrButton
          label="Check again"
          icon="arrow.clockwise"
          busy={refreshing}
          onPress={() => void refresh()}
        />
      </PrStateMessage>
    );

  return (
    <View className="flex-1">
      <View className="gap-2 px-3 pb-2 pt-2.5">
        <SearchField
          value={search}
          onChange={setSearch}
          busy={search.trim() !== query || (listing.isPending && query !== "")}
        />
        <View className="flex-row items-center gap-2">
          <ControlPillMenu
            actions={sortActions}
            title="Sort loaded pull requests"
            onPressAction={(event) => {
              const value = PULL_REQUEST_SORT_OPTIONS.find(
                (option) => `sort:${option.value}` === event.nativeEvent.event,
              )?.value;
              if (value) props.onFiltersChange({ sort: value });
            }}
          >
            <PrToolbarButton
              icon="arrow.up.arrow.down"
              label="Sort"
              accessibilityLabel={`Sort, ${sortLabel}`}
              active={filters.sort !== DEFAULT_PULL_REQUEST_FILTERS.sort}
            />
          </ControlPillMenu>
          <PrToolbarButton
            icon="line.3.horizontal.decrease.circle"
            label="Filters"
            accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
            active={filterCount > 0}
            badge={filterCount}
            onPress={() => setSheetOpen(true)}
          />
          {props.environments.length > 1 ? (
            <ControlPillMenu
              actions={environmentActions}
              title="Environment"
              className="min-w-0 shrink"
              onPressAction={(event) => {
                const id = event.nativeEvent.event.slice("environment:".length);
                if (id !== props.environmentId) props.onEnvironmentChange(id);
              }}
            >
              <PrToolbarButton
                icon="server.rack"
                label={environmentLabel}
                accessibilityLabel={`Environment, ${environmentLabel}`}
                showChevron
              />
            </ControlPillMenu>
          ) : null}
          <View className="flex-1" />
          <RefreshButton refreshing={refreshing} onPress={() => void refresh()} />
        </View>
      </View>
      <View className="flex-1 border-t border-border">
        {body ?? (
          <FlatList
            data={entries}
            keyExtractor={pullRequestRowKey}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            onEndReached={canLoadMore ? loadMore : undefined}
            onEndReachedThreshold={0.6}
            initialNumToRender={12}
            contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
            ListHeaderComponent={
              notices.length > 0 ? (
                <View className="pt-2">
                  <PrNotice
                    lines={notices}
                    actionLabel={listing.error ? "Retry" : undefined}
                    onAction={() => void refresh()}
                  />
                </View>
              ) : undefined
            }
            ListFooterComponent={
              canLoadMore || loadingMore ? (
                <View className="items-center py-3">
                  {loadingMore ? (
                    <ActivityIndicator />
                  ) : (
                    <PrButton label="Load more" onPress={loadMore} />
                  )}
                </View>
              ) : undefined
            }
            renderItem={({ item }) => (
              <PullRequestRow
                entry={item}
                selected={
                  props.selected !== null &&
                  props.selected.projectId === item.projectId &&
                  props.selected.repository === item.repository &&
                  props.selected.number === item.number
                }
                onSelect={props.onSelect}
              />
            )}
          />
        )}
      </View>
      <PullRequestFiltersSheet
        visible={sheetOpen}
        filters={filters}
        projects={props.projects}
        unavailable={unavailable}
        onChange={props.onFiltersChange}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

function SearchField(props: { value: string; onChange: (value: string) => void; busy: boolean }) {
  const foreground = String(useUniwindTheme()["--color-foreground"]);
  const placeholder = String(useUniwindTheme()["--color-placeholder"]);
  const iconColor = String(useUniwindTheme()["--color-icon-subtle"]);
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-lg border border-input-border bg-input pl-3">
      {props.busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <SymbolView name="magnifyingglass" size={16} tintColor={iconColor} type="monochrome" />
      )}
      <TextInput
        accessibilityLabel="Search pull requests"
        placeholder="Search title, #number or author"
        placeholderTextColor={placeholder}
        value={props.value}
        onChangeText={props.onChange}
        maxLength={200}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="min-w-0 flex-1 py-0 font-t3-regular text-[15px]"
        style={{ color: foreground }}
      />
      {props.value ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          className="size-11 items-center justify-center"
          onPress={() => props.onChange("")}
        >
          <SymbolView name="xmark.circle.fill" size={17} tintColor={iconColor} type="monochrome" />
        </Pressable>
      ) : null}
    </View>
  );
}

function RefreshButton(props: { refreshing: boolean; onPress: () => void }) {
  const iconColor = String(useUniwindTheme()["--color-icon"]);
  return (
    <Pressable
      accessibilityLabel="Refresh pull requests"
      accessibilityRole="button"
      accessibilityState={{ busy: props.refreshing }}
      disabled={props.refreshing}
      onPress={props.onPress}
      className="size-11 items-center justify-center rounded-lg border border-input-border bg-input active:bg-subtle-strong"
    >
      {props.refreshing ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <SymbolView name="arrow.clockwise" size={16} tintColor={iconColor} type="monochrome" />
      )}
    </Pressable>
  );
}

/** Static placeholders in the row's own rhythm; nothing animates while the first page loads. */
function ListSkeleton() {
  return (
    <View accessibilityLabel="Loading pull requests" className="pt-1">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View key={index} className="flex-row gap-3 px-4 py-3.5">
          <View className="mt-0.5 size-4 rounded-full bg-subtle-strong" />
          <View className="flex-1 gap-2">
            <View className="h-3.5 w-[82%] rounded bg-subtle-strong" />
            <View className="h-3 w-[48%] rounded bg-subtle" />
            <View className="h-3 w-[36%] rounded bg-subtle" />
          </View>
        </View>
      ))}
    </View>
  );
}

const PullRequestRow = memo(function PullRequestRow(props: {
  entry: PullRequestListEntry;
  selected: boolean;
  onSelect: (entry: PullRequestListEntry) => void;
}) {
  const { entry } = props;
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const presentation = resolvePullRequestPresentation(entry, scheme);
  const hasStats = entry.additions > 0 || entry.deletions > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${presentation.label} pull request ${entry.number}: ${entry.title}, ${entry.repository}${entry.viewerReviewRequested ? ", review requested" : ""}`}
      accessibilityState={{ selected: props.selected }}
      onPress={() => props.onSelect(entry)}
      className={cn(
        "min-h-16 flex-row gap-3 border-b border-border px-4 py-3",
        props.selected ? "bg-subtle-strong" : "active:bg-subtle",
      )}
    >
      <View className="pt-0.5">
        <SymbolView
          name={presentation.icon}
          size={17}
          tintColor={presentation.color}
          type="monochrome"
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          numberOfLines={2}
          className="text-[15px] font-t3-medium leading-[20px] text-foreground"
        >
          {entry.title}
        </Text>
        <Text numberOfLines={1} className="text-[13px] text-foreground-muted">
          <Text className="text-[13px] text-foreground-secondary">{entry.repository}</Text>
          {` #${entry.number}`}
        </Text>
        <Text numberOfLines={1} className="text-xs text-foreground-tertiary">
          {entry.author?.login ?? "ghost"}
          {" · "}
          {entry.headBranch}
          {presentation.label === "Open" ? "" : ` · ${presentation.label}`}
        </Text>
        {entry.viewerReviewRequested && entry.state === "open" ? (
          <Text className="pt-0.5 text-xs font-t3-medium text-foreground-secondary">
            Review requested
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-0.5 pt-0.5">
        <Text className="text-xs text-foreground-tertiary">{relativeTime(entry.updatedAt)}</Text>
        {hasStats ? (
          <Text className="text-xs">
            <Text className="text-xs text-primary-text">+{entry.additions}</Text>
            <Text className="text-xs text-foreground-tertiary"> </Text>
            <Text className="text-xs text-danger-foreground">-{entry.deletions}</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
