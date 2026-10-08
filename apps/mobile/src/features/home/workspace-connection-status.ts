import type { EnvironmentId, EnvironmentMachineKind } from "@t3tools/contracts";

import type { WorkspaceEnvironment, WorkspaceState } from "../../state/workspaceModel";

export interface WorkspaceDeviceStatus {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly machineKind: EnvironmentMachineKind;
  readonly isConnected: boolean;
  /** Untruncated, for the tap reveal. */
  readonly statusLabel: string;
}

function deviceStatusLabel(environment: WorkspaceEnvironment): string {
  switch (environment.connectionState) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "offline":
      return "Offline";
    case "error":
      return environment.connectionError ?? "Connection failed";
    case "unsupported":
      return environment.connectionError ?? "Unsupported";
    case "available":
      return "Not connected";
  }
}

export function workspaceDeviceStatuses(
  environments: ReadonlyArray<WorkspaceEnvironment>,
  machineByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentMachineKind>,
  networkStatus: WorkspaceState["networkStatus"] = "online",
): ReadonlyArray<WorkspaceDeviceStatus> {
  return environments
    .filter((environment) => environment.isEnabled)
    .map((environment) => ({
      environmentId: environment.environmentId,
      label: environment.environmentLabel,
      machineKind: machineByEnvironmentId.get(environment.environmentId) ?? "server",
      isConnected: networkStatus !== "offline" && environment.connectionState === "connected",
      statusLabel: networkStatus === "offline" ? "Offline" : deviceStatusLabel(environment),
    }));
}
