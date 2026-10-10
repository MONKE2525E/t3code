import type { GrokBot } from "@t3tools/contracts";
import { StarIcon } from "lucide-react";
import { type CSSProperties, useId } from "react";

import { cn } from "~/lib/utils";

import {
  BotRenderer,
  DEFAULT_FILL,
  bodyForShape,
  createAppearance,
  inkForColor,
} from "./engine/grokBotEngine.generated.js";
import { GROK_BOT_AVATAR_COLORS } from "./grokBotAvatarShapes";
import { resolveGrokBotAvatarFill, resolveGrokBotAvatarKind } from "./grokBotPresentation";

const SIZE_PX = { xs: 24, sm: 32, md: 40, lg: 72 } as const;

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
 * (see `engine/`). It animates on its own (blinks, glances, idle motion), stops
 * when scrolled off screen, and settles under `prefers-reduced-motion`.
 * `active` makes the bot emphasized, as the app does for the selected bot.
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
  const pixels = SIZE_PX[size];
  const id = `grok-bot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const kind = resolveGrokBotAvatarKind(bot.avatarShape);

  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
      style={
        {
          width: pixels,
          height: pixels,
          "--grok-bot-ink": resolveInk(bot.avatarColor),
        } as CSSProperties
      }
    >
      <BotRenderer
        appearance={APPEARANCE}
        body={bodyForShape(kind)}
        fill={DEFAULT_FILL}
        id={id}
        seed={bot.name}
        size={pixels}
        state="idle"
        isEmphasized={active}
        maxFrameRate={30}
      />
      {featured ? (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm">
          <StarIcon className="size-2 fill-current" />
        </span>
      ) : null}
    </span>
  );
}
