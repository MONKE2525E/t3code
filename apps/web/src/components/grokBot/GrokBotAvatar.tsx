import type { GrokBot } from "@t3tools/contracts";
import { StarIcon } from "lucide-react";
import { type CSSProperties, useEffect, useId, useRef } from "react";

import { cn } from "~/lib/utils";

import {
  BotRenderer,
  DEFAULT_FILL,
  bodyForShape,
  createAppearance,
  inkForColor,
  recipeByName,
} from "./engine/grokBotEngine.generated.js";
import type { GrokBotActivity } from "./grokBotActivity";
import { GROK_BOT_AVATAR_COLORS } from "./grokBotAvatarShapes";
import { resolveGrokBotAvatarFill, resolveGrokBotAvatarKind } from "./grokBotPresentation";

const SIZE_PX = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;

const IDLE_CLIP = recipeByName("Idle_B");
/**
 * The app's resting bots hold the start of its Idle_B clip, turned a little up
 * and to the right: the same clip with its rotation pinned to that glance.
 */
const RESTING_CLIP = {
  ...IDLE_CLIP,
  name: "GrokBotResting",
  tracks: {
    ...IDLE_CLIP.tracks,
    rotation: [{ t: 0, v: [-18, 20, 0], ease: [0.42, 0, 0.58, 1] }],
    expression: [],
  },
};

// Eyes are cut out of the body, so they show whatever is behind the avatar.
const APPEARANCE = createAppearance("var(--grok-bot-ink)");

function resolveInk(color: string): string {
  const token = color.trim().toLowerCase();
  return Object.hasOwn(GROK_BOT_AVATAR_COLORS, token)
    ? inkForColor(token)
    : resolveGrokBotAvatarFill(color);
}

/**
 * A Grok Bot face, drawn by the same procedural engine as the Grok Bot app
 * (see `engine/`). Like the app, it rests in a still pose and only moves while
 * `state` names something the bot is doing; the engine also stops it while off
 * screen.
 */
export function GrokBotAvatar({
  bot,
  size = "md",
  featured = false,
  state,
  spinSignal = 0,
  className,
}: {
  readonly bot: Pick<GrokBot, "name" | "avatarShape" | "avatarColor">;
  readonly size?: keyof typeof SIZE_PX;
  readonly featured?: boolean;
  readonly state?: GrokBotActivity | undefined;
  /** Changes to this number make the bot do a spin, as when its look is edited. */
  readonly spinSignal?: number;
  readonly className?: string;
}) {
  const pixels = SIZE_PX[size];
  const id = `grok-bot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const kind = resolveGrokBotAvatarKind(bot.avatarShape);
  const renderer = useRef<{ poke: (kind: "spin" | "bounce" | "nod") => void } | null>(null);
  const lastSpin = useRef(spinSignal);
  useEffect(() => {
    if (spinSignal === lastSpin.current) return;
    lastSpin.current = spinSignal;
    renderer.current?.poke("spin");
  }, [spinSignal]);
  const body = bodyForShape(kind);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 [&_svg:not([class*='size-'])]:size-full!",
        className,
      )}
      style={
        {
          width: pixels,
          height: pixels,
          "--grok-bot-ink": resolveInk(bot.avatarColor),
        } as CSSProperties
      }
    >
      <BotRenderer
        ref={renderer}
        // Remount between rest and activity: the engine's own rest pose is a
        // tilted logo pose, while the app's resting bots hold the first frame
        // of the Idle_B clip (upright, eyes looking up).
        key={state === undefined ? "rest" : "active"}
        appearance={APPEARANCE}
        body={body}
        fill={DEFAULT_FILL}
        id={id}
        seed={bot.name}
        size={pixels}
        isPlaying={state !== undefined}
        maxFrameRate={30}
        {...(state === undefined ? { clip: RESTING_CLIP } : { state })}
      />
      {featured ? (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm">
          <StarIcon className="size-2 fill-current" />
        </span>
      ) : null}
    </span>
  );
}
