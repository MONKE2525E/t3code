import { EnvironmentId, ProjectId, type PullRequestRef } from "@t3tools/contracts";
import { useNavigation, usePreventRemove, type StaticScreenProps } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { useProjects } from "../../state/entities";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import {
  DEFAULT_PULL_REQUEST_FILTERS,
  type PullRequestFilters,
  usesPullRequestSplitView,
} from "./pull-request-model";
import { PrStateMessage } from "./pull-request-components";
import { PullRequestDetailPane } from "./PullRequestDetailScreen";
import { PullRequestListPane } from "./PullRequestListPane";

/**
 * The list and the selected pull request. On a phone one of them fills the screen; on a wide
 * pane (an unfolded Z Fold, a tablet) they sit side by side. Both stay mounted through a fold, so
 * the scroll position, the open tab and a half-written comment survive the change.
 */
export function PullRequestsScreen(
  props: StaticScreenProps<
    { environmentId?: string; projectId?: string; repository?: string; number?: number } | undefined
  >,
) {
  const projects = useProjects();
  const navigation = useNavigation();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const environments = Object.values(savedConnectionsById);
  const [selectedEnvironment, setSelectedEnvironment] = useState(
    props.route.params?.environmentId ?? "",
  );
  const environmentId =
    selectedEnvironment || environments[0]?.environmentId || projects[0]?.environmentId;
  const [filters, setFilters] = useState<PullRequestFilters>(() => ({
    ...DEFAULT_PULL_REQUEST_FILTERS,
    projectId: props.route.params?.projectId,
  }));
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<PullRequestRef | null>(() => {
    const params = props.route.params;
    return params?.projectId && params.repository && params.number
      ? {
          projectId: ProjectId.make(params.projectId),
          repository: params.repository,
          number: params.number,
        }
      : null;
  });
  const split = usesPullRequestSplitView(width);
  // A native thread link opens straight into one pull request; Back then returns to the thread.
  const openedFromLink = props.route.params?.number !== undefined;
  const showDetailOnly = selected !== null && !split;
  usePreventRemove(showDetailOnly && !openedFromLink, () => setSelected(null));

  const onFiltersChange = useCallback(
    (patch: Partial<PullRequestFilters>) => setFilters((current) => ({ ...current, ...patch })),
    [],
  );
  const onSelect = useCallback(
    (entry: PullRequestRef) =>
      setSelected({
        projectId: entry.projectId,
        repository: entry.repository,
        number: entry.number,
      }),
    [],
  );
  const onEnvironmentChange = useCallback((next: string) => {
    setSelectedEnvironment(next);
    setFilters((current) => ({ ...current, projectId: undefined }));
    setSelected(null);
  }, []);
  const closeDetail = useCallback(
    () => (openedFromLink ? navigation.goBack() : setSelected(null)),
    [navigation, openedFromLink],
  );

  const environment = environmentId ? EnvironmentId.make(environmentId) : null;
  const scopedProjects = projects.filter((project) => project.environmentId === environmentId);
  const listWidth = width >= 900 ? 380 : 330;

  return (
    <View
      className="flex-1 bg-screen"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {showDetailOnly ? null : (
        <AndroidScreenHeader title="Pull requests" onBack={() => navigation.goBack()} />
      )}
      {environment ? (
        <View className="flex-1 flex-row">
          <View
            className={split ? "border-r border-border" : "flex-1"}
            style={[
              split ? { width: listWidth } : null,
              { display: showDetailOnly ? "none" : "flex" },
            ]}
          >
            <PullRequestListPane
              key={environment}
              environmentId={environment}
              environments={environments}
              onEnvironmentChange={onEnvironmentChange}
              projects={scopedProjects}
              filters={filters}
              onFiltersChange={onFiltersChange}
              selected={selected}
              onSelect={onSelect}
            />
          </View>
          <View className="min-w-0 flex-1" style={{ display: split || selected ? "flex" : "none" }}>
            {selected ? (
              <PullRequestDetailPane
                key={JSON.stringify([environment, selected])}
                environmentId={environment}
                reference={selected}
                onBack={showDetailOnly ? closeDetail : undefined}
              />
            ) : (
              <PrStateMessage
                icon="arrow.triangle.pull"
                title="Select a pull request"
                message="Its summary, conversation and changed files open here."
              />
            )}
          </View>
        </View>
      ) : (
        <PrStateMessage
          icon="server.rack"
          title="No environment connected"
          message="Connect an environment to browse its pull requests."
        />
      )}
    </View>
  );
}
