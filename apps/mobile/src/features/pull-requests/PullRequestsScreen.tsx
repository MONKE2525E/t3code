import { EnvironmentId, type PullRequestListEntry, type PullRequestRef } from "@t3tools/contracts";
import { useNavigation, usePreventRemove, type StaticScreenProps } from "@react-navigation/native";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { useProjects } from "../../state/entities";
import { serverEnvironment } from "../../state/server";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import {
  DEFAULT_PULL_REQUEST_FILTERS,
  type PullRequestFilters,
  usesPullRequestSplitView,
} from "./pull-request-model";
import { PrStateMessage } from "./pull-request-components";
import { PullRequestDetailPane, type PullRequestPreview } from "./PullRequestDetailScreen";
import { PullRequestListPane } from "./PullRequestListPane";

/**
 * The list and the selected pull request. On a phone one of them fills the screen; on a wide
 * pane (an unfolded Z Fold, a tablet) they sit side by side. Both stay mounted through a fold, so
 * the scroll position, the open tab and a half-written comment survive the change.
 */
export function PullRequestsScreen(
  props: StaticScreenProps<{ environmentId?: string } | undefined>,
) {
  const projects = useProjects();
  const navigation = useNavigation();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const environments = Object.values(savedConnectionsById);
  const preferences = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const savedFilters = AsyncResult.isSuccess(preferences)
    ? preferences.value.pullRequestList
    : undefined;
  const [selectedEnvironment, setSelectedEnvironment] = useState(
    props.route.params?.environmentId ?? "",
  );
  const environmentId =
    selectedEnvironment ||
    (environments.some((entry) => entry.environmentId === savedFilters?.environmentId)
      ? savedFilters?.environmentId
      : undefined) ||
    environments[0]?.environmentId ||
    projects[0]?.environmentId;
  const filters: PullRequestFilters = {
    state: savedFilters?.state ?? DEFAULT_PULL_REQUEST_FILTERS.state,
    involvement: savedFilters?.involvement ?? DEFAULT_PULL_REQUEST_FILTERS.involvement,
    sort: savedFilters?.sort ?? DEFAULT_PULL_REQUEST_FILTERS.sort,
    projectId:
      savedFilters?.environmentId === environmentId &&
      projects.some(
        (project) =>
          project.environmentId === environmentId && project.id === savedFilters?.projectId,
      )
        ? savedFilters?.projectId
        : undefined,
  };
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<PullRequestRef | null>(null);
  const [preview, setPreview] = useState<PullRequestPreview | null>(null);
  const split = usesPullRequestSplitView(width);
  const showDetailOnly = selected !== null && !split;
  usePreventRemove(showDetailOnly, () => setSelected(null));

  const onFiltersChange = useCallback(
    (patch: Partial<PullRequestFilters>) =>
      savePreferences({
        transform: (current) => ({
          pullRequestList: {
            ...current.pullRequestList,
            projectId:
              current.pullRequestList?.environmentId === environmentId
                ? current.pullRequestList?.projectId
                : undefined,
            ...patch,
            environmentId,
          },
        }),
      }),
    [savePreferences, environmentId],
  );
  const onSelect = useCallback((entry: PullRequestListEntry) => {
    setSelected({
      projectId: entry.projectId,
      repository: entry.repository,
      number: entry.number,
      ...(entry.host ? { host: entry.host } : {}),
    });
    setPreview(entry);
  }, []);
  const onEnvironmentChange = useCallback(
    (next: string) => {
      setSelectedEnvironment(next);
      savePreferences({
        transform: (current) => ({
          pullRequestList: {
            ...current.pullRequestList,
            environmentId: next,
            projectId: undefined,
          },
        }),
      });
      setSelected(null);
    },
    [savePreferences],
  );

  const environment = environmentId ? EnvironmentId.make(environmentId) : null;
  // Undefined until the environment has said what it can do; the list reads that as loading.
  const pullRequestsSupported = useAtomValue(
    serverEnvironment.configValueAtom(environment),
    (config) => config?.environment.capabilities.pullRequests,
  );
  const scopedProjects = projects.filter((project) => project.environmentId === environmentId);
  const listWidth = width >= 900 ? 380 : 330;

  return (
    <View
      className="flex-1 bg-header"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {environment ? (
        <PullRequestListPane
          key={environment}
          environmentId={environment}
          environments={environments}
          onEnvironmentChange={onEnvironmentChange}
          projects={scopedProjects}
          pullRequestsSupported={pullRequestsSupported}
          filters={filters}
          onFiltersChange={onFiltersChange}
          selected={selected}
          onSelect={onSelect}
          search={search}
          onSearchChange={setSearch}
          onBack={() => navigation.goBack()}
          layout={{ split, showDetailOnly, listWidth }}
          detail={
            selected ? (
              <PullRequestDetailPane
                key={JSON.stringify([environment, selected])}
                environmentId={environment}
                reference={selected}
                preview={preview}
                onBack={showDetailOnly ? () => setSelected(null) : undefined}
              />
            ) : (
              <PrStateMessage
                icon="arrow.triangle.pull"
                title="Select a pull request"
                message="Its summary, conversation and changed files open here."
              />
            )
          }
        />
      ) : (
        <>
          <AndroidScreenHeader
            title="Pull requests"
            onBack={() => navigation.goBack()}
            hideBottomBorder
          />
          <View className="flex-1 overflow-hidden rounded-t-[28px] bg-screen">
            <PrStateMessage
              icon="server.rack"
              title="No environment connected"
              message="Connect an environment to browse its pull requests."
            />
          </View>
        </>
      )}
    </View>
  );
}
