import type { GrokBot } from "@t3tools/contracts";
import { StarIcon } from "lucide-react";
import { type CSSProperties, useMemo } from "react";

import { cn } from "~/lib/utils";

import { GROK_BOT_AVATAR_SHAPES, grokBotEyeLayout } from "./grokBotAvatarShapes";
import {
  resolveGrokBotAvatarEyeColor,
  resolveGrokBotAvatarFill,
  resolveGrokBotAvatarKind,
} from "./grokBotPresentation";

const SIZE_PX = { xs: 24, sm: 32, md: 40, lg: 72 } as const;

/**
 * A Grok Bot face. The body is static SVG; the eyes are two HTML pills so the
 * blink and glance animate as compositor-only transforms (see `.grok-bot-eye`
 * in index.css). Each bot gets its own animation phase from its name so a
 * roster never blinks in unison. `active` adds a gentle bob for the selected
 * or busy bot; everything stops under `prefers-reduced-motion`.
 */
export function GrokBotAvatar({
  bot,
  size = "md",
  featured = false,
  active = false,
  className,
}: {
  readonly bot: Pick<GrokBot, "name" | "avatarShape" | "avatarColor">;
  readonly size?: keyof typeof SIZE_PX;
  readonly featured?: boolean;
  readonly active?: boolean;
  readonly className?: string;
}) {
  const kind = resolveGrokBotAvatarKind(bot.avatarShape);
  const fill = resolveGrokBotAvatarFill(bot.avatarColor);
  const eyeColor = resolveGrokBotAvatarEyeColor(fill);
  const pixels = SIZE_PX[size];
  const { eyeX, eyeY, tilt } = grokBotEyeLayout(kind);
  const phase = useMemo(() => phaseFor(bot.name), [bot.name]);

  return (
    <span
      className={cn("grok-bot-avatar relative inline-flex shrink-0", className)}
      data-active={active || undefined}
      style={
        {
          width: pixels,
          height: pixels,
          "--grok-bot-delay": `${-phase * 7}s`,
          "--grok-bot-glance": `${(phase > 0.5 ? 1 : -1) * Math.max(1, pixels / 18)}px`,
        } as CSSProperties
      }
    >
      <svg aria-hidden className="size-full" viewBox="0 0 64 64" fill={fill} color={fill}>
        {GROK_BOT_AVATAR_SHAPES[kind].body}
      </svg>
      <span
        aria-hidden
        className="grok-bot-eyes absolute"
        style={{
          left: `${(eyeX / 64) * 100}%`,
          top: `${(eyeY / 64) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
        }}
      >
        <span className="grok-bot-eye" style={{ backgroundColor: eyeColor }} />
        <span className="grok-bot-eye" style={{ backgroundColor: eyeColor }} />
      </span>
      {featured ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm"
        >
          <StarIcon className="size-2 fill-current" />
        </span>
      ) : null}
    </span>
  );
}

/** Stable 0..1 phase so each bot blinks on its own schedule. */
function phaseFor(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 1000) / 1000;
}
