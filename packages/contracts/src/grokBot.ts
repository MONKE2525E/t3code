import * as Schema from "effect/Schema";
import { PullRequestRef } from "./pullRequest.ts";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const GrokBotId = TrimmedNonEmptyString.check(Schema.isMaxLength(128));
export const GrokBotPullRequest = Schema.Struct({
  reference: PullRequestRef,
  url: Schema.String,
  title: Schema.String,
  state: Schema.Literals(["open", "closed"]),
});
export const GrokBot = Schema.Struct({
  id: GrokBotId,
  name: Schema.String,
  label: Schema.String,
  description: Schema.String,
  avatarShape: Schema.String,
  avatarColor: Schema.String,
  notificationEnabled: Schema.Boolean,
  hidden: Schema.Boolean,
  pinned: Schema.Boolean,
  featured: Schema.Boolean,
  pullRequests: Schema.Array(GrokBotPullRequest),
});
export type GrokBot = typeof GrokBot.Type;

export const GrokBotStatus = Schema.Struct({
  installed: Schema.Boolean,
  managed: Schema.Boolean,
  sessionPresent: Schema.Boolean,
});
export const GrokBotReadInput = Schema.Struct({ botId: GrokBotId });
export const GrokBotMessage = Schema.Struct({
  id: Schema.String,
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String,
  timestampMs: Schema.Number,
  streaming: Schema.Boolean,
});
export const GrokBotConversation = Schema.Struct({
  bot: GrokBot,
  messages: Schema.Array(GrokBotMessage),
});
export const GrokBotSendInput = Schema.Struct({
  botId: GrokBotId,
  message: TrimmedNonEmptyString.check(Schema.isMaxLength(64000)),
});
export const GrokBotSendResult = Schema.Struct({ accepted: Schema.Boolean });
export const GrokBotUpdateInput = Schema.Struct({
  botId: GrokBotId,
  name: Schema.optionalKey(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  label: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(200))),
  description: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(16000))),
  notificationEnabled: Schema.optionalKey(Schema.Boolean),
  hidden: Schema.optionalKey(Schema.Boolean),
  pinned: Schema.optionalKey(Schema.Boolean),
  featured: Schema.optionalKey(Schema.Boolean),
});
export const GrokBotLinkInput = Schema.Struct({
  botId: GrokBotId,
  reference: PullRequestRef,
  remove: Schema.optionalKey(Schema.Boolean),
});
export class GrokBotError extends Schema.TaggedError<GrokBotError>()("GrokBotError", {
  reason: Schema.Literals([
    "cli_unavailable",
    "signed_out",
    "gateway_failed",
    "invalid_response",
    "bot_not_found",
    "storage_failed",
    "delivery_unknown",
    "setup_failed",
    "pr_failed",
  ]),
}) {
  override get message(): string {
    switch (this.reason) {
      case "cli_unavailable":
        return "Set up the Grok Bot bridge in Settings → Grok Bots.";
      case "signed_out":
        return "Open Grok Bot and sign in, then refresh the connection.";
      case "bot_not_found":
        return "This bot is no longer in your Grok Bot account.";
      case "storage_failed":
        return "Grok Bot preferences could not be saved or loaded.";
      case "delivery_unknown":
        return "Message delivery is uncertain. Refresh the conversation before sending again.";
      case "setup_failed":
        return "The bridge could not be installed. Check that Node.js and npm are available.";
      case "pr_failed":
        return "The pull request could not be read. Check the selected project and source control sign-in.";
      case "invalid_response":
        return "The Grok Bot bridge returned an unsupported response.";
      default:
        return "Grok Bot could not be reached. Open the desktop app and refresh the connection.";
    }
  }
}
