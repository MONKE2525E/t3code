import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  compareGrokBots,
  grokBotPullRequestRefFromUrl,
  grokBotSettingsDestinationSearch,
  grokBotSurfaceKey,
  isGitHubChangeRequestHost,
  isGrokBotPullRequestUrl,
  partitionGrokBotRoster,
  resolveGrokBotAvatarFill,
  resolveGrokBotAvatarKind,
  resolveGrokBotSelectedEnvironment,
  resolveGrokBotSettingsEnvironment,
  retainGrokBotSettingsBotIdSearch,
  sortGrokBotsForEditor,
  validateGrokBotConversationSearch,
  validateGrokBotSettingsSearch,
} from "./grokBotPresentation";

function bot(partial: {
  id: string;
  name: string;
  featured?: boolean;
  hidden?: boolean;
  pinned?: boolean;
}) {
  return {
    id: partial.id,
    name: partial.name,
    label: "",
    description: "",
    avatarShape: "blob",
    avatarColor: "#22c55e",
    notificationEnabled: false,
    hidden: partial.hidden ?? false,
    pinned: partial.pinned ?? false,
    featured: partial.featured ?? false,
    pullRequests: [],
  };
}

describe("partitionGrokBotRoster", () => {
  it("puts featured bots in tiles and keeps hidden bots out", () => {
    const roster = partitionGrokBotRoster([
      bot({ id: "a", name: "Alpha", featured: true }),
      bot({ id: "b", name: "Beta" }),
      bot({ id: "c", name: "Hidden", hidden: true, featured: true }),
      bot({ id: "d", name: "Pinned", pinned: true }),
    ]);
    expect(roster.featured.map((entry) => entry.id)).toEqual(["a"]);
    expect(roster.rows.map((entry) => entry.id)).toEqual(["d", "b"]);
  });
});

describe("sortGrokBotsForEditor", () => {
  it("orders featured, then pinned, then name", () => {
    const sorted = sortGrokBotsForEditor([
      bot({ id: "c", name: "Charlie" }),
      bot({ id: "a", name: "Alpha", pinned: true }),
      bot({ id: "b", name: "Bravo", featured: true }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
  });
});

describe("compareGrokBots", () => {
  it("pins first", () => {
    expect(
      compareGrokBots(bot({ id: "a", name: "A" }), bot({ id: "b", name: "B", pinned: true })),
    ).toBe(1);
  });
});

describe("grokBotPullRequestRefFromUrl", () => {
  const project = {
    id: ProjectId.make("project-1"),
    repositoryIdentity: {
      provider: "github",
      owner: "acme",
      name: "widget",
      canonicalKey: "github.com/acme/widget",
      locator: {
        source: "git-remote" as const,
        remoteName: "origin",
        remoteUrl: "https://github.com/acme/widget.git",
      },
    },
  };

  it("parses a GitHub pull request URL onto the chosen project", () => {
    expect(grokBotPullRequestRefFromUrl("https://github.com/acme/widget/pull/42", project)).toEqual(
      {
        projectId: "project-1",
        host: "github.com",
        repository: "acme/widget",
        number: 42,
      },
    );
  });

  it("keeps the pasted repository when the number matches another repo", () => {
    expect(
      grokBotPullRequestRefFromUrl("https://github.com/other/backend/pull/42", project),
    ).toEqual({
      projectId: "project-1",
      host: "github.com",
      repository: "other/backend",
      number: 42,
    });
  });

  it("keeps an Enterprise host and repository from the pasted URL", () => {
    expect(
      grokBotPullRequestRefFromUrl("https://github.acme.test/platform/api/pull/7", project),
    ).toEqual({
      projectId: "project-1",
      host: "github.acme.test",
      repository: "platform/api",
      number: 7,
    });
  });

  it("rejects non-GitHub change request URLs", () => {
    expect(
      grokBotPullRequestRefFromUrl("https://gitlab.com/acme/widget/-/merge_requests/42", project),
    ).toBeNull();
  });
});

describe("isGitHubChangeRequestHost", () => {
  it("accepts github.com and Enterprise hosts the URL parser already allows", () => {
    expect(isGitHubChangeRequestHost("github.com")).toBe(true);
    expect(isGitHubChangeRequestHost("github.acme.test")).toBe(true);
    expect(isGrokBotPullRequestUrl("https://github.acme.test/platform/api/pull/7")).toBe(true);
    expect(isGrokBotPullRequestUrl("https://gitlab.com/acme/widget/pull/42")).toBe(false);
  });
});

describe("grokBotSettingsDestinationSearch", () => {
  it("writes the clicked environment onto the settings machine axis", () => {
    expect(
      grokBotSettingsDestinationSearch({
        environmentId: EnvironmentId.make("env-bot"),
        botId: "dr-chicken",
      }),
    ).toEqual({
      machine: "env-bot",
      botId: "dr-chicken",
    });
  });

  it("omits a machine when the destination has no environment", () => {
    expect(grokBotSettingsDestinationSearch({ botId: "dr-chicken" })).toEqual({
      botId: "dr-chicken",
    });
  });
});

describe("retainGrokBotSettingsBotIdSearch", () => {
  it("keeps the selected bot when the settings scope changes", () => {
    expect(retainGrokBotSettingsBotIdSearch({ botId: "dr-chicken" }, {})).toEqual({
      botId: "dr-chicken",
    });
  });

  it("lets an explicit bot destination replace the previous bot", () => {
    expect(
      retainGrokBotSettingsBotIdSearch({ botId: "dr-chicken" }, { botId: "other-bot" }),
    ).toEqual({ botId: "other-bot" });
  });
});

describe("resolveGrokBotSettingsEnvironment", () => {
  const connected = ["env-a", "env-b"];

  it("uses the scoped environment when it is connected", () => {
    expect(
      resolveGrokBotSettingsEnvironment({
        scopeKind: "environment",
        scopeEnvironmentId: "env-b",
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "environment", environmentId: "env-b" });
  });

  it("honors a disconnected destination instead of another connected account", () => {
    expect(
      resolveGrokBotSettingsEnvironment({
        scopeKind: "environment",
        scopeEnvironmentId: "env-offline",
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "disconnected", environmentId: "env-offline" });
  });

  it("does not pick the first connected account for All environments", () => {
    expect(
      resolveGrokBotSettingsEnvironment({
        scopeKind: "all",
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "choose-environment" });
  });

  it("asks to connect when no environment is available", () => {
    expect(
      resolveGrokBotSettingsEnvironment({
        scopeKind: "all",
        connectedEnvironmentIds: [],
      }),
    ).toEqual({ kind: "no-environment" });
  });
});

describe("resolveGrokBotSelectedEnvironment", () => {
  const connected = ["env-a", "env-b"];

  it("uses the selected environment when it is connected", () => {
    expect(
      resolveGrokBotSelectedEnvironment({
        selectedEnvironmentId: EnvironmentId.make("env-b"),
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "environment", environmentId: "env-b" });
  });

  it("keeps an explicit disconnected destination instead of another connected account", () => {
    expect(
      resolveGrokBotSelectedEnvironment({
        selectedEnvironmentId: EnvironmentId.make("missing-environment"),
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "disconnected", environmentId: "missing-environment" });
  });

  it("does not pick a connected account when no environment is selected", () => {
    expect(
      resolveGrokBotSelectedEnvironment({
        selectedEnvironmentId: null,
        connectedEnvironmentIds: connected,
      }),
    ).toEqual({ kind: "no-environment" });
  });
});

describe("grokBotSurfaceKey", () => {
  it("distinguishes the same bot id on two environments", () => {
    expect(grokBotSurfaceKey("env-a", "shared-bot")).not.toEqual(
      grokBotSurfaceKey("env-b", "shared-bot"),
    );
  });
});

describe("avatar helpers", () => {
  it("maps known shapes, legacy aliases, and colors", () => {
    expect(resolveGrokBotAvatarKind("leaf")).toBe("leaf");
    expect(resolveGrokBotAvatarKind("triangle")).toBe("wedge");
    expect(resolveGrokBotAvatarFill("violet")).toBe("#9159fe");
    expect(resolveGrokBotAvatarFill("#8b5cf6")).toBe("#8b5cf6");
    expect(resolveGrokBotAvatarFill("not-a-color")).toMatch(/^#/);
  });
});

describe("validateGrokBotConversationSearch", () => {
  it("keeps a selected environment identity", () => {
    expect(validateGrokBotConversationSearch({ environmentId: "env-1" })).toEqual({
      environmentId: EnvironmentId.make("env-1"),
    });
    expect(validateGrokBotConversationSearch({})).toEqual({});
  });
});

describe("validateGrokBotSettingsSearch", () => {
  it("keeps a selected bot", () => {
    expect(validateGrokBotSettingsSearch({ botId: "dr-chicken" })).toEqual({
      botId: "dr-chicken",
    });
    expect(validateGrokBotSettingsSearch({})).toEqual({});
  });
});
