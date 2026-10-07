import type {
  PullRequestActivity,
  PullRequestComment,
  PullRequestReviewVerdict,
} from "@t3tools/contracts";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { relativeTime } from "../../lib/time";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import type { EnvironmentQueryView } from "../../state/query";
import { FileMarkdownPreview } from "../files/FileMarkdownPreview";
import { pullRequestFailureMessage } from "./pull-request-model";
import { PrButton, PrChoice, PrNotice, PrStateMessage } from "./pull-request-components";
import type { PullRequestComposerState } from "./usePullRequestComposer";

const VERDICT_LABEL: Record<PullRequestReviewVerdict, string> = {
  comment: "Comment",
  approve: "Approve",
  "request-changes": "Request changes",
};

const REVIEW_STATE_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Requested changes",
  COMMENTED: "Reviewed",
  DISMISSED: "Dismissed",
};

function reviewStateLabel(state: string | null) {
  return state ? (REVIEW_STATE_LABEL[state.toUpperCase()] ?? state.toLowerCase()) : null;
}

function Commits(props: { commits: PullRequestActivity["commits"] }) {
  const [open, setOpen] = useState(false);
  const iconColor = String(useUniwindTheme()["--color-icon-subtle"]);
  if (props.commits.length === 0) return null;
  return (
    <View className="border-b border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        className="min-h-11 flex-row items-center justify-between px-4"
      >
        <Text className="text-sm font-t3-medium text-foreground-secondary">
          {props.commits.length} {props.commits.length === 1 ? "commit" : "commits"}
        </Text>
        <SymbolView
          name={open ? "chevron.up" : "chevron.down"}
          size={13}
          tintColor={iconColor}
          type="monochrome"
        />
      </Pressable>
      {open ? (
        <View className="gap-1.5 px-4 pb-3">
          {props.commits.map((commit) => (
            <View key={commit.oid} className="flex-row gap-2.5">
              <Text className="font-mono text-xs text-foreground-tertiary">
                {commit.oid.slice(0, 7)}
              </Text>
              <Text numberOfLines={2} className="min-w-0 flex-1 text-[13px] text-foreground-muted">
                {commit.messageHeadline}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CommentItem(props: { item: PullRequestComment; onLinkPress: (href: string) => void }) {
  const { item } = props;
  const login = item.author?.login ?? "ghost";
  const review = reviewStateLabel(item.reviewState);
  return (
    <View className="border-b border-border">
      <View className="flex-row items-center gap-2.5 px-4 pt-3.5">
        <View className="size-6 items-center justify-center rounded-full bg-subtle-strong">
          <Text className="text-[11px] font-t3-bold text-foreground-secondary">
            {login.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text numberOfLines={1} className="shrink text-sm font-t3-medium text-foreground">
          {login}
        </Text>
        <Text className="text-xs text-foreground-tertiary">{relativeTime(item.createdAt)}</Text>
        {review ? (
          <Text className="text-xs font-t3-medium text-foreground-secondary">{review}</Text>
        ) : null}
      </View>
      {item.path ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="head"
          className="px-4 pt-1.5 font-mono text-xs text-foreground-muted"
        >
          {item.path}
        </Text>
      ) : null}
      <View style={{ minHeight: 65 }}>
        <FileMarkdownPreview
          embedded
          markdown={item.body || "_No comment body._"}
          onLinkPress={props.onLinkPress}
        />
      </View>
    </View>
  );
}

function Composer(props: {
  composer: PullRequestComposerState;
  canComment: boolean;
  verdicts: ReadonlyArray<PullRequestReviewVerdict>;
  target: string;
}) {
  const { composer, canComment, verdicts } = props;
  const [focused, setFocused] = useState(false);
  const foreground = String(useUniwindTheme()["--color-foreground"]);
  const placeholder = String(useUniwindTheme()["--color-placeholder"]);
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const insets = useSafeAreaInsets();
  const modes = [
    ...(canComment ? (["comment"] as const) : []),
    ...verdicts.filter((verdict) => verdict !== "comment"),
  ];
  const verdict = modes.includes(composer.verdict) ? composer.verdict : modes[0];
  if (!verdict) {
    return (
      <View className="border-t border-border px-4 py-3">
        <Text className="text-sm text-foreground-muted">
          Comments are not available on this pull request. Open it on its host to respond.
        </Text>
      </View>
    );
  }
  const expanded = focused || composer.body.length > 0 || composer.busy || composer.error !== null;
  const canSend =
    !composer.busy && (verdict === "comment" ? composer.body.trim().length > 0 : true);
  const confirm = () =>
    Alert.alert(
      verdict === "comment" ? "Post comment?" : "Submit review?",
      `This will publish to ${props.target}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: () => void composer.send(verdict) },
      ],
    );
  return (
    <View
      className="gap-2 border-t border-border bg-screen px-3 pt-2.5"
      style={{ paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 10) }}
    >
      {composer.error ? <PrNotice flush lines={[composer.error]} /> : null}
      {expanded && modes.length > 1 ? (
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {modes.map((mode) => (
            <PrChoice
              key={mode}
              label={VERDICT_LABEL[mode]}
              selected={verdict === mode}
              onPress={() => composer.setVerdict(mode)}
            />
          ))}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Pull request comment or review"
        placeholder={verdict === "comment" ? "Add a comment" : "Add a note to your review"}
        placeholderTextColor={placeholder}
        multiline
        value={composer.body}
        onChangeText={composer.setBody}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!composer.busy}
        maxLength={65536}
        textAlignVertical="top"
        className="max-h-36 min-h-11 rounded-lg border border-input-border bg-input px-3 py-2.5 font-t3-regular text-[15px]"
        style={{ color: foreground }}
      />
      {expanded ? (
        <View className="flex-row justify-end">
          <PrButton
            variant="primary"
            label={verdict === "comment" ? "Post comment" : VERDICT_LABEL[verdict]}
            busy={composer.busy}
            disabled={!canSend}
            onPress={confirm}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The conversation, with the composer pinned below it. Commits sit behind one collapsed row,
 * since the comments are what a reviewer came for.
 */
export function PullRequestTimelineTab(props: {
  activity: EnvironmentQueryView<PullRequestActivity>;
  composer: PullRequestComposerState;
  canComment: boolean;
  verdicts: ReadonlyArray<PullRequestReviewVerdict>;
  target: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** Opens a link in a comment, natively when it names a pull request. */
  onLinkPress: (href: string) => void;
}) {
  const { activity } = props;
  const data = activity.data;
  const refreshColor = String(useUniwindTheme()["--color-icon"]);
  return (
    <KeyboardAvoidingView automaticOffset behavior="padding" className="min-h-0 flex-1">
      {data === null ? (
        activity.error ? (
          <PrStateMessage
            icon="text.bubble"
            title="Could not load pull request activity"
            message={pullRequestFailureMessage(activity.error)}
          >
            <PrButton label="Retry" icon="arrow.clockwise" onPress={activity.refresh} />
          </PrStateMessage>
        ) : (
          <PrStateMessage icon="text.bubble" title="Loading conversation" loading />
        )
      ) : (
        <FlatList
          className="flex-1"
          data={data.comments}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={props.refreshing}
              onRefresh={props.onRefresh}
              tintColor={refreshColor}
            />
          }
          contentContainerStyle={{ paddingBottom: 8 }}
          ListHeaderComponent={
            <>
              {activity.error ? (
                <View className="pt-2">
                  <PrNotice
                    lines={[
                      `${pullRequestFailureMessage(activity.error)} Showing the last activity loaded.`,
                    ]}
                    actionLabel="Retry"
                    onAction={activity.refresh}
                  />
                </View>
              ) : null}
              <Commits commits={data.commits} />
            </>
          }
          ListEmptyComponent={
            <View className="items-center px-6 py-10">
              <Text className="text-sm text-foreground-muted">No comments yet.</Text>
            </View>
          }
          ListFooterComponent={
            data.commentsTruncated ? (
              <View className="px-4 py-3">
                <Text className="text-[13px] text-foreground-muted">
                  Showing {data.comments.length} of {data.commentCount} comments. Open the pull
                  request on its host for the full conversation.
                </Text>
              </View>
            ) : activity.isPending ? (
              <ActivityIndicator className="m-4" />
            ) : undefined
          }
          renderItem={({ item }) => <CommentItem item={item} onLinkPress={props.onLinkPress} />}
        />
      )}
      <Composer
        composer={props.composer}
        canComment={props.canComment}
        verdicts={props.verdicts}
        target={props.target}
      />
    </KeyboardAvoidingView>
  );
}
