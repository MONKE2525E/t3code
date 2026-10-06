import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { useProjects, useThreadShells } from "../../state/entities";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import { parseNativePullRequestUrl } from "./pull-request-model";

export function useOpenPullRequest() {
  const navigation = useNavigation();
  const projects = useProjects();
  const threads = useThreadShells();
  return useCallback(
    async (url: string, environmentId: string, threadId: string) => {
      const thread = threads.find(
        (item) => item.environmentId === environmentId && item.id === threadId,
      );
      const project = projects.find(
        (item) => item.environmentId === environmentId && item.id === thread?.projectId,
      );
      const parsed = parseNativePullRequestUrl(url);
      if (project && parsed) {
        navigation.navigate("PullRequestDetail", {
          environmentId,
          projectId: project.id,
          repository: parsed.repository,
          number: parsed.number,
        });
        return true;
      }
      return tryOpenExternalUrl(url, "pull-request");
    },
    [navigation, projects, threads],
  );
}
