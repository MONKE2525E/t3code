import { useMemo, useState, type ReactNode } from "react";
import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  EnrichedMarkdownText,
  type LinkPillContent,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { parseMarkdownWithOptions } from "react-native-nitro-markdown/headless";
import {
  markdownFileIconSource,
  markdownIconAssetUri,
} from "@t3tools/mobile-markdown-text/file-icons";
import { markdownLinkIconSource } from "@t3tools/mobile-markdown-text/link-icons";
import { resolveMarkdownLinkIcon } from "@t3tools/mobile-markdown-text/links";
import type { SelectableMarkdownTextProps } from "@t3tools/mobile-markdown-text/types";

import { AndroidAnchoredMenu } from "../components/AndroidAnchoredMenu";
import { enrichedMarkdownLinks } from "../lib/enrichedMarkdown";
import { nativeMarkdownWithAuthoredWindowsPaths } from "@t3tools/mobile-markdown-text/markdown";

type Props = Omit<SelectableMarkdownTextProps, "highlightCode"> & {
  readonly fallback: ReactNode;
};

export function EnrichedSelectableMarkdownText({ fallback, ...props }: Props) {
  const links = useMemo(() => {
    if (props.contextClipboardFragment) return null;
    const document = parseMarkdownWithOptions(props.markdown, {
      gfm: true,
      html: true,
      math: false,
    });
    // MD4C unescapes authored Windows destinations. Keep the renderer that
    // restores those paths so pills never open a different file.
    if (nativeMarkdownWithAuthoredWindowsPaths(document, props.markdown) !== document) return null;
    return enrichedMarkdownLinks(document, props.skills);
  }, [props.markdown, props.skills, props.contextClipboardFragment]);
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const style = props.textStyle;
  const markdownStyle = useMemo(() => {
    const body = {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      marginTop: 0,
      marginBottom: 10,
    };
    const heading = (index: number) => ({
      ...body,
      color: style.strongColor,
      fontFamily: style.headingFontFamily,
      fontWeight: "700",
      fontSize: style.headingFontSizes?.[index] ?? [22, 19, 17, 16, 15, 15][index],
      marginTop: 12,
    });
    return {
      paragraph: body,
      h1: heading(0),
      h2: heading(1),
      h3: heading(2),
      h4: heading(3),
      h5: heading(4),
      h6: heading(5),
      strong: { color: style.strongColor, fontFamily: style.boldFontFamily },
      list: { ...body, bulletColor: style.mutedColor, markerColor: style.mutedColor },
      blockquote: { ...body, borderColor: style.quoteMarkerColor, borderWidth: 3, padding: 8 },
      code: {
        color: style.inlineCodeColor,
        backgroundColor: style.codeBackgroundColor,
        fontFamily: "monospace",
      },
      codeBlock: {
        ...body,
        color: style.codeColor,
        backgroundColor: style.codeBlockBackgroundColor,
        fontFamily: "monospace",
        padding: 12,
        borderRadius: 8,
        borderColor: style.dividerColor,
        syntaxColors: {
          keyword: style.linkColor,
          string: style.inlineCodeColor,
          number: style.linkColor,
          constant: style.linkColor,
          comment: style.mutedColor,
          function: style.strongColor,
          type: style.linkColor,
          property: style.codeColor,
          tag: style.linkColor,
          attribute: style.strongColor,
        },
      },
      link: { color: style.linkColor, underline: false },
      linkVariants: {
        ".*": {
          backgroundColor: style.codeBackgroundColor,
          pill: {
            borderRadius: 12,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderWidth: 1,
            borderColor: style.dividerColor,
          },
        },
      },
      thematicBreak: { color: style.dividerColor },
      table: {
        ...body,
        borderColor: style.dividerColor,
        headerBackgroundColor: style.codeBackgroundColor,
        headerTextColor: style.strongColor,
        headerFontFamily: style.boldFontFamily,
      },
      taskList: {
        checkedColor: style.linkColor,
        borderColor: style.mutedColor,
        checkedTextColor: style.mutedColor,
      },
    } satisfies MarkdownStyle;
  }, [style]);
  const linkPillContent = useMemo(() => {
    const content: Record<string, LinkPillContent> = {};
    for (const [url, link] of links ?? []) {
      if (link.kind === "file") {
        content[url] = {
          iconUri: markdownIconAssetUri(markdownFileIconSource(link.icon)),
        };
        continue;
      }
      const icon = link.kind === "external" ? resolveMarkdownLinkIcon(link.host) : null;
      if (icon)
        content[url] = {
          iconUri: markdownIconAssetUri(markdownLinkIconSource(icon)),
          iconTintColor: style.linkColor,
        };
    }
    return content;
  }, [links, style.linkColor]);
  if (links === null) return fallback;

  const resolvedUrl = (url: string) => links.get(url)?.href ?? url;
  const openLink = (url: string) => {
    if (props.onLinkPress) props.onLinkPress(resolvedUrl(url));
    else void Linking.openURL(resolvedUrl(url));
  };
  const fileMenu = menuUrl ? props.fileContextMenu?.(resolvedUrl(menuUrl)) : undefined;
  const actions =
    fileMenu && props.onFileContextMenuAction
      ? fileMenu.actions.map((action) => ({
          id: action.id,
          title: action.title,
          attributes: { disabled: action.disabled },
        }))
      : [
          { id: "open", title: "Open link" },
          { id: "copy", title: "Copy link" },
        ];
  return (
    <AndroidAnchoredMenu
      style={{
        flexShrink: 1,
        minWidth: 0,
        marginTop: props.marginTop,
        marginBottom: props.marginBottom,
      }}
      title={fileMenu?.title ?? menuUrl ?? undefined}
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        if (!menuUrl) return;
        if (fileMenu && props.onFileContextMenuAction)
          props.onFileContextMenuAction(resolvedUrl(menuUrl), nativeEvent.event);
        else if (nativeEvent.event === "open") openLink(menuUrl);
        else if (nativeEvent.event === "copy") void Clipboard.setStringAsync(resolvedUrl(menuUrl));
      }}
    >
      {(openMenu) => (
        <EnrichedMarkdownText
          markdown={props.markdown}
          flavor="github"
          markdownStyle={markdownStyle}
          linkPillContent={linkPillContent}
          selectable
          selectionColor={style.selectionColor}
          selectionHandleColor={style.selectionHandleColor}
          enableTaskListItemToggle={false}
          md4cFlags={{ latexMath: false, hardSoftBreaks: props.preserveSoftBreaks }}
          spoilerOverlay="solid"
          onLinkPress={({ url }) => openLink(url)}
          onLinkLongPress={({ url }) => {
            setMenuUrl(url);
            openMenu();
          }}
        />
      )}
    </AndroidAnchoredMenu>
  );
}
