import { describe, expect, it } from "vite-plus/test";
import type { MarkdownNode } from "react-native-nitro-markdown/headless";

import { enrichedMarkdownLinks } from "./enrichedMarkdown";

const document = (...children: MarkdownNode[]): MarkdownNode => ({ type: "document", children });
const text = (content: string): MarkdownNode => ({ type: "text", content });

describe("enrichedMarkdownLinks", () => {
  it("keeps ordinary Markdown and external links on the native renderer", () => {
    const links = enrichedMarkdownLinks(
      document({
        type: "paragraph",
        children: [
          text("See "),
          {
            type: "link",
            href: "https://github.com/pingdotgg/t3code",
            children: [text("T3 Code")],
          },
        ],
      }),
    );
    expect(links?.get("https://github.com/pingdotgg/t3code")).toMatchObject({
      kind: "external",
      host: "github.com",
    });
  });

  it("routes explicit workspace links with their normalized destination", () => {
    const links = enrichedMarkdownLinks(
      document({
        type: "paragraph",
        children: [
          {
            type: "link",
            href: "src/app.ts#L12",
            children: [text("app.ts")],
          },
        ],
      }),
    );
    expect(links?.get("src/app.ts#L12")).toMatchObject({
      kind: "file",
      path: "src/app.ts",
      line: 12,
    });
  });

  it("retains T3's resolver for images nested inside links and lists", () => {
    expect(
      enrichedMarkdownLinks(
        document({
          type: "list",
          children: [
            {
              type: "list_item",
              children: [
                {
                  type: "link",
                  href: "https://example.com",
                  children: [{ type: "image", href: "./photo.png" }],
                },
              ],
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("retains canonical copying for context links", () => {
    expect(
      enrichedMarkdownLinks(
        document({
          type: "paragraph",
          children: [
            {
              type: "link",
              href: "t3-context://v1/file/example",
              children: [text("file")],
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("retains file actions created from inline code", () => {
    expect(
      enrichedMarkdownLinks(
        document({
          type: "paragraph",
          children: [
            {
              type: "code_inline",
              content: "src/app.ts",
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("retains the authored skill renderer", () => {
    expect(
      enrichedMarkdownLinks(
        document({ type: "paragraph", children: [text("Use $test-t3-mobile")] }),
        [{ name: "test-t3-mobile" }],
      ),
    ).toBeNull();
  });

  it("keeps code contents literal instead of interpreting their file paths as links", () => {
    expect(
      enrichedMarkdownLinks(
        document({ type: "code_block", content: "src/app.ts", language: "sh" }),
      ),
    ).not.toBeNull();
  });
});
