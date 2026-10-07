import {
  createPullRequestEnvironmentAtoms,
  createPullRequestStackAtomFamily,
} from "@t3tools/client-runtime/state/pull-requests";
import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const composerPullRequests = {
  list: createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
    label: "mobile:composer:pull-requests",
    tag: WS_METHODS.pullRequestsList,
    staleTimeMs: 30_000,
  }),
  detail: createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
    label: "mobile:composer:pull-request-detail",
    tag: WS_METHODS.pullRequestsDetail,
    staleTimeMs: 60_000,
  }),
};

export const pullRequestEnvironment = createPullRequestEnvironmentAtoms(connectionAtomRuntime);

/** The host-native stack a pull request belongs to; null where it is not stacked. */
export const pullRequestStack = createPullRequestStackAtomFamily(
  connectionAtomRuntime,
  pullRequestEnvironment.refreshes,
);
