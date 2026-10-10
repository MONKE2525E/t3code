import {
  GrokBot,
  GrokBotConversation,
  GrokBotError,
  GrokBotStatus,
  GrokBotReadInput,
  GrokBotSendInput,
  GrokBotSendResult,
  GrokBotUpdateInput,
  GrokBotLinkInput,
  OrchestratorMcpFailure,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";
import * as GrokBotService from "../../../grokBot/GrokBotService.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const shared = {
  failure: Schema.Union([GrokBotError, OrchestratorMcpFailure]),
  failureMode: "return" as const,
  dependencies: [
    GrokBotService.GrokBotService,
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
};
export const GrokBotToolkit = Toolkit.make(
  Tool.make("grok_bots_status", {
    ...shared,
    description:
      "Check whether this environment has a Grok Bot CLI bridge and a desktop session. No credentials are returned.",
    success: GrokBotStatus,
  }).annotate(Tool.Readonly, true),
  Tool.make("grok_bots_setup", {
    ...shared,
    description:
      "Install the pinned unofficial Grok Bot bridge inside this T3 instance's home. Requires full access. Uses the Grok Bot desktop app's existing sign-in.",
    success: GrokBotStatus,
  }),
  Tool.make("grok_bots_list", {
    ...shared,
    description:
      "List the signed-in account's real persistent Grok Bots and their T3 pin, featured, and PR associations.",
    success: Schema.Array(GrokBot),
  }).annotate(Tool.Readonly, true),
  Tool.make("grok_bot_read", {
    ...shared,
    description:
      "Read a bot's bounded recent conversation. Merged PR associations are removed without settling the bot.",
    parameters: GrokBotReadInput,
    success: GrokBotConversation,
  }).annotate(Tool.Readonly, true),
  Tool.make("grok_bot_send", {
    ...shared,
    description:
      "Send one message to a real Grok Bot. An uncertain-delivery error must be reconciled by reading the conversation; do not resend automatically.",
    parameters: GrokBotSendInput,
    success: GrokBotSendResult,
  }),
  Tool.make("grok_bot_update", {
    ...shared,
    description:
      "Update a bot's real profile or notifications, or its T3 pin/featured preference. Omitted fields are preserved.",
    parameters: GrokBotUpdateInput,
    success: GrokBot,
  }),
  Tool.make("grok_bot_link_pull_request", {
    ...shared,
    description:
      "Associate a PR with a bot, or remove it with remove=true. A confirmed merge removes only that association; the bot stays persistent.",
    parameters: GrokBotLinkInput,
    success: GrokBot,
  }),
);
