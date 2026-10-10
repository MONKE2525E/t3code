import { useSyncExternalStore } from "react";

/**
 * What a bot is doing right now, as the avatar engine's named states. A bot
 * with no activity rests in its still pose; it only moves while one is set.
 */
export type GrokBotActivity =
  | "loading"
  | "sending"
  | "thinking"
  | "streaming"
  | "finished"
  | "failed"
  | "celebrate"
  | "notifying";

const activities = new Map<string, GrokBotActivity>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Sets or clears a bot's activity. With `clearAfterMs` the bot returns to rest
 * on its own, which is how one-shot reactions (finished, failed) end.
 */
export function setGrokBotActivity(
  key: string,
  activity: GrokBotActivity | null,
  clearAfterMs?: number,
) {
  const timer = timers.get(key);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(key);
  if (activity === null) activities.delete(key);
  else activities.set(key, activity);
  if (activity !== null && clearAfterMs !== undefined) {
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        activities.delete(key);
        emit();
      }, clearAfterMs),
    );
  }
  emit();
}

export function useGrokBotActivity(key: string): GrokBotActivity | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => activities.get(key),
    () => undefined,
  );
}

/** Current activity without subscribing, for event handlers. */
export function getGrokBotActivity(key: string): GrokBotActivity | undefined {
  return activities.get(key);
}
