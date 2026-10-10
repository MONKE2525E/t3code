import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { WS_METHODS } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { AtomRegistry } from "effect/reactivity";

import { connectionAtomRuntime } from "../connection/runtime";

const GROK_BOTS_ROSTER_REFRESH_MS = 30_000;
const GROK_BOTS_CONVERSATION_REFRESH_MS = 5_000;

export const grokBotsStatusQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:grok-bots:status",
  tag: WS_METHODS.grokBotsStatus,
  staleTimeMs: 5_000,
  idleTtlMs: 5 * 60_000,
  refreshIntervalMs: GROK_BOTS_ROSTER_REFRESH_MS,
});

export const grokBotsListQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:grok-bots:list",
  tag: WS_METHODS.grokBotsList,
  staleTimeMs: 5_000,
  idleTtlMs: 5 * 60_000,
  refreshIntervalMs: GROK_BOTS_ROSTER_REFRESH_MS,
});

export const grokBotsReadQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:grok-bots:read",
  tag: WS_METHODS.grokBotsRead,
  staleTimeMs: 1_000,
  idleTtlMs: 5 * 60_000,
  refreshIntervalMs: GROK_BOTS_CONVERSATION_REFRESH_MS,
});

function refreshGrokBotRoster(registry: AtomRegistry.AtomRegistry, environmentId: EnvironmentId) {
  registry.refresh(grokBotsStatusQuery({ environmentId, input: {} }));
  registry.refresh(grokBotsListQuery({ environmentId, input: {} }));
}

function refreshGrokBotConversation(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
  botId: string,
) {
  refreshGrokBotRoster(registry, environmentId);
  registry.refresh(grokBotsReadQuery({ environmentId, input: { botId } }));
}

export const grokBotsSetup = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:grok-bots:setup",
  tag: WS_METHODS.grokBotsSetup,
  onSuccess: (target, registry) =>
    Effect.sync(() => refreshGrokBotRoster(registry, target.environmentId)),
});

export const grokBotsSend = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:grok-bots:send",
  tag: WS_METHODS.grokBotsSend,
  concurrency: {
    mode: "serial",
    key: (target) => `${target.environmentId}:${target.input.botId}`,
  },
  onSuccess: (target, registry) =>
    Effect.sync(() =>
      refreshGrokBotConversation(registry, target.environmentId, target.input.botId),
    ),
});

export const grokBotsUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:grok-bots:update",
  tag: WS_METHODS.grokBotsUpdate,
  concurrency: {
    mode: "serial",
    key: (target) => `${target.environmentId}:${target.input.botId}`,
  },
  onSuccess: (target, registry) =>
    Effect.sync(() =>
      refreshGrokBotConversation(registry, target.environmentId, target.input.botId),
    ),
});

export const grokBotsLink = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:grok-bots:link",
  tag: WS_METHODS.grokBotsLink,
  concurrency: {
    mode: "serial",
    key: (target) => `${target.environmentId}:${target.input.botId}`,
  },
  onSuccess: (target, registry) =>
    Effect.sync(() =>
      refreshGrokBotConversation(registry, target.environmentId, target.input.botId),
    ),
});
