import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  external: vi.fn().mockResolvedValue(true),
  projects: [
    {
      id: "project-a",
      environmentId: "env-a",
      repositoryIdentity: {
        canonicalKey: "github.com/example/app",
        provider: "github",
        displayName: "example/app",
        owner: "example",
        name: "app",
        locator: {
          source: "git-remote",
          remoteName: "origin",
          remoteUrl: "https://github.com/example/app.git",
        },
      },
    },
  ],
}));
vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: mocks.dispatch }),
  StackActions: { push: (name: string, params: unknown) => ({ type: "PUSH", name, params }) },
}));
vi.mock("../../lib/openExternalUrl", () => ({ tryOpenExternalUrl: mocks.external }));
vi.mock("../../state/projects", () => ({ environmentProjects: { projectsAtom: "projects" } }));
vi.mock("../../state/server", () => ({ serverEnvironment: { configValueAtom: () => "config" } }));
vi.mock("../../state/atom-registry", () => ({
  appAtomRegistry: {
    get: (atom: string) =>
      atom === "projects"
        ? mocks.projects
        : { environment: { capabilities: { pullRequests: true, threadPullRequests: true } } },
  },
}));

import { useOpenPullRequest } from "./useOpenPullRequest";

describe("opening a PR from chat", () => {
  beforeEach(() => vi.clearAllMocks());
  it("opens only the detail route with the originating thread, without opening GitHub", async () => {
    const open = useOpenPullRequest();
    expect(
      await open("https://github.com/example/app/pull/42", "env-a", "pull-request", "thread-a"),
    ).toBe(true);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: "PUSH",
      name: "PullRequestDetail",
      params: {
        environmentId: "env-a",
        projectId: "project-a",
        repository: "example/app",
        number: 42,
        host: "github.com",
        threadId: "thread-a",
      },
    });
    expect(mocks.external).not.toHaveBeenCalled();
  });
  it("keeps ordinary links external without navigating away from the thread", async () => {
    const open = useOpenPullRequest();
    await open("https://example.com/docs", "env-a", "pull-request", "thread-a");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.external).toHaveBeenCalledWith("https://example.com/docs", "pull-request");
  });
});
