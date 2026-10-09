import { nativeMarkdownDocumentRuns } from "@t3tools/mobile-markdown-text/markdown";
import { resolveMarkdownLinkPresentation } from "@t3tools/mobile-markdown-text/links";
import type { SelectableMarkdownSkill } from "@t3tools/mobile-markdown-text/types";
import type { MarkdownNode } from "react-native-nitro-markdown/headless";

/** Keep T3's media resolver and canonical context-copy behavior on their existing renderer. */
export function enrichedMarkdownLinks(
  document: MarkdownNode,
  skills: ReadonlyArray<SelectableMarkdownSkill> = [],
) {
  const links = new Map<string, ReturnType<typeof resolveMarkdownLinkPresentation>>();
  let needsT3Renderer = false;
  const visit = (node: MarkdownNode) => {
    if (
      node.type === "image" ||
      node.type === "html_block" ||
      node.type === "html_inline" ||
      node.type === "math_block"
    ) {
      needsT3Renderer = true;
    }
    if (node.type === "link" && node.href) {
      if (node.href.startsWith("t3-context:")) needsT3Renderer = true;
      links.set(node.href, resolveMarkdownLinkPresentation(node.href));
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(document);
  if (needsT3Renderer) return null;

  const destinations = new Set(
    Array.from(links.values()).flatMap((link) => (link.href ? [link.href] : [])),
  );
  // The T3 renderer also turns authored @mentions, skills and inline-code paths
  // into links. Passing the original Markdown to MD4C would lose those actions.
  if (
    nativeMarkdownDocumentRuns(document, skills).some(
      (run) => run.skillName != null || (run.href && !destinations.has(run.href)),
    )
  ) {
    return null;
  }
  return links;
}
