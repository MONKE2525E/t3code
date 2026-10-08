import { describe, expect, it } from "vite-plus/test";

import type { WorkspaceEnvironment } from "../../state/workspaceModel";
import { workspaceDeviceStatuses } from "./workspace-connection-status";

describe("workspace device statuses", () => {
  function environment(overrides: Partial<WorkspaceEnvironment> = {}): WorkspaceEnvironment {
    return {
      environmentId: "environment-1" as never,
      environmentLabel: "Julius’s Mac mini",
      displayUrl: "",
      isRelayManaged: false,
      isEnabled: true,
      connectionState: "connected",
      connectionError: null,
      connectionErrorTraceId: null,
      ...overrides,
    };
  }

  it("keeps configured devices in order and uses each device's machine kind", () => {
    const environments = [
      environment({ environmentId: "a" as never, environmentLabel: "Laptop" }),
      environment({ environmentId: "b" as never, environmentLabel: "Studio" }),
    ];
    const machines = new Map([["b" as never, "mac-studio" as const]]);

    expect(workspaceDeviceStatuses(environments, machines)).toEqual([
      {
        environmentId: "a",
        label: "Laptop",
        machineKind: "server",
        isConnected: true,
        statusLabel: "Connected",
      },
      {
        environmentId: "b",
        label: "Studio",
        machineKind: "mac-studio",
        isConnected: true,
        statusLabel: "Connected",
      },
    ]);
  });

  it("reports untruncated status for every not-connected phase", () => {
    const statusFor = (overrides: Partial<WorkspaceEnvironment>) =>
      workspaceDeviceStatuses([environment(overrides)], new Map())[0]!;

    expect(statusFor({ connectionState: "reconnecting" })).toMatchObject({
      isConnected: false,
      statusLabel: "Reconnecting",
    });
    expect(statusFor({ connectionState: "offline" }).statusLabel).toBe("Offline");
    expect(statusFor({ connectionState: "available" }).statusLabel).toBe("Not connected");
    expect(statusFor({ connectionState: "unsupported" }).statusLabel).toBe("Unsupported");
    expect(
      statusFor({
        connectionState: "error",
        connectionError: "Could not reach the Julius’s Mac mini environment over the tailnet",
      }).statusLabel,
    ).toBe("Could not reach the Julius’s Mac mini environment over the tailnet");
  });

  it("excludes deliberately switched-off devices", () => {
    expect(workspaceDeviceStatuses([environment({ isEnabled: false })], new Map())).toEqual([]);
  });

  it("marks cached connected devices offline when the network goes offline", () => {
    expect(workspaceDeviceStatuses([environment()], new Map(), "offline")[0]).toMatchObject({
      isConnected: false,
      statusLabel: "Offline",
    });
  });
});
