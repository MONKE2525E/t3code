import type { PullRequestAction } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  pullRequestActionConfirmation,
  pullRequestMenuGroups,
  type PullRequestMenuInput,
} from "./pull-request-actions";

const ALL: PullRequestAction[] = ["merge", "ready", "draft", "close", "reopen", "revert"];

function input(
  detail: Partial<PullRequestMenuInput["detail"]> = {},
  rest: Partial<Omit<PullRequestMenuInput, "detail">> = {},
): PullRequestMenuInput {
  return {
    detail: {
      state: "open",
      isDraft: false,
      mergeability: "mergeable",
      autoMergeEnabled: false,
      checks: [],
      provider: "github",
      mergeCapabilities: { merge: true, squash: true, rebase: false },
      capabilities: { mergeMethods: ["merge", "squash", "rebase"], actions: ALL },
      viewerPermissions: { actions: ALL },
      ...detail,
    } as PullRequestMenuInput["detail"],
    thread: null,
    canMergeSingle: true,
    mergeMethod: "squash",
    refreshing: false,
    actionPending: false,
    handoffPending: false,
    ...rest,
  };
}

const ids = (value: PullRequestMenuInput) =>
  pullRequestMenuGroups(value)
    .flat()
    .map((i) => i.id);

describe("pullRequestMenuGroups", () => {
  it("offers each merge strategy the repository allows, plus draft and close", () => {
    expect(ids(input())).toEqual([
      "refresh",
      "ask",
      "explain",
      "fix-findings",
      "draft",
      "merge:merge",
      "merge:squash",
      "open-host",
      "copy-link",
      "copy-number",
      "close",
    ]);
  });

  it("hides merges for drafts, conflicts, stacks and viewers without permission", () => {
    const merges = (value: PullRequestMenuInput) =>
      ids(value).filter((id) => id.startsWith("merge:"));
    expect(merges(input({ isDraft: true }))).toEqual([]);
    expect(merges(input({ mergeability: "conflicting" }))).toEqual([]);
    expect(merges(input({}, { canMergeSingle: false }))).toEqual([]);
    expect(merges(input({ viewerPermissions: { actions: ["close"] } } as never))).toEqual([]);
  });

  it("offers the reverse of each terminal state the host allows", () => {
    expect(ids(input({ isDraft: true }))).toContain("draft");
    expect(
      pullRequestMenuGroups(input({ isDraft: true }))
        .flat()
        .find((item) => item.id === "draft")?.title,
    ).toBe("Ready for review");
    expect(ids(input({ state: "closed" }))).toContain("reopen");
    expect(ids(input({ state: "merged" }))).toContain("revert");
    expect(ids(input({ state: "merged" }))).not.toContain("close");
  });

  it("acts on the originating thread and names it, and offers nothing to unlink outside one", () => {
    const inThread = pullRequestMenuGroups(
      input({}, { thread: { linked: true, canLink: true } }),
    ).flat();
    expect(inThread[0]).toMatchObject({ id: "link", title: "Unlink from this thread" });
    expect(inThread.find((item) => item.id === "fix-findings")?.title).toBe(
      "Fix findings in this thread",
    );
    const outside = pullRequestMenuGroups(input()).flat();
    expect(outside.some((item) => item.id === "link")).toBe(false);
    expect(outside.find((item) => item.id === "fix-findings")?.title).toBe(
      "Fix findings in a thread",
    );
  });

  it("disables host actions while one is pending", () => {
    const items = pullRequestMenuGroups(input({}, { actionPending: true })).flat();
    expect(items.find((item) => item.id === "close")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "copy-link")?.disabled).toBeUndefined();
  });
});

describe("pullRequestActionConfirmation", () => {
  it("confirms merges, close and revert, and runs draft changes directly", () => {
    expect(pullRequestActionConfirmation({ kind: "merge", method: "squash" }, 7)).toMatchObject({
      confirmText: "Squash and merge",
      message: "This merges #7 using squash.",
    });
    expect(pullRequestActionConfirmation({ kind: "action", action: "close" }, 7)?.destructive).toBe(
      true,
    );
    expect(pullRequestActionConfirmation({ kind: "action", action: "revert" }, 7)).not.toBeNull();
    expect(pullRequestActionConfirmation({ kind: "action", action: "draft" }, 7)).toBeNull();
  });
});
