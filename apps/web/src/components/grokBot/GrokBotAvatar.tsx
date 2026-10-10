import type { GrokBot } from "@t3tools/contracts";
import { StarIcon } from "lucide-react";

import { cn } from "~/lib/utils";

import { resolveGrokBotAvatarFill, resolveGrokBotAvatarKind } from "./grokBotPresentation";

export function GrokBotAvatar({
  bot,
  size = "md",
  featured = false,
  className,
}: {
  readonly bot: Pick<GrokBot, "name" | "avatarShape" | "avatarColor">;
  readonly size?: "sm" | "md" | "lg";
  readonly featured?: boolean;
  readonly className?: string;
}) {
  const kind = resolveGrokBotAvatarKind(bot.avatarShape);
  const fill = resolveGrokBotAvatarFill(bot.avatarColor);
  const pixels = size === "lg" ? 64 : size === "sm" ? 28 : 40;
  const lightFill = isLightFill(fill);

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: pixels, height: pixels }}
    >
      <svg aria-hidden className="size-full" viewBox="0 0 64 64">
        {kind === "triangle" ? (
          <path
            d="M32 6.5c1.4 0 2.7.7 3.4 1.9l22 38.2c.8 1.3.8 3 0 4.3-.8 1.3-2.2 2.1-3.7 2.1H10.3c-1.5 0-2.9-.8-3.7-2.1-.8-1.3-.8-3 0-4.3l22-38.2C29.3 7.2 30.6 6.5 32 6.5Z"
            fill={fill}
            stroke={lightFill ? "rgba(15,23,42,0.16)" : "none"}
          />
        ) : kind === "cloud" ? (
          <path
            d="M22.5 18.5c4.4-5.8 12.8-6.8 18.4-2.3 2.1-1.6 4.9-2.4 7.7-2 6.3.8 10.9 6.6 10.4 12.9 4.4 1.6 7.2 6 6.7 10.9-.6 5.7-5.6 10-11.4 10H14.8C8.6 47.9 4 42.8 4.2 36.6c.2-5.2 3.9-9.6 8.9-10.8 1.2-3.4 4.7-7.3 9.4-7.3Z"
            fill={fill}
            stroke={lightFill ? "rgba(15,23,42,0.16)" : "none"}
          />
        ) : kind === "diamond" ? (
          <path
            d="M32 5.5c1.1 0 2.1.4 2.8 1.2l22.5 22.5c1.6 1.6 1.6 4.1 0 5.6L34.8 57.3c-1.5 1.6-4.1 1.6-5.6 0L6.7 34.8c-1.6-1.5-1.6-4.1 0-5.6L29.2 6.7C29.9 5.9 30.9 5.5 32 5.5Z"
            fill={fill}
            stroke={lightFill ? "rgba(15,23,42,0.16)" : "none"}
          />
        ) : (
          <path
            d="M18.2 10.8c7.6-6.4 20.4-7.4 28.4-1.6 5.4 3.9 8.6 10.6 8.8 17.6.2 6.4-2.1 12.8-6.9 17.3-5.6 5.2-13.6 8.4-21.6 7.2-7.6-1.1-14.4-6.3-17.1-13.4-2.8-7.3-1.3-16.3 3.6-22.4 1.4-1.8 3.1-3.4 4.8-4.7Z"
            fill={fill}
            stroke={lightFill ? "rgba(15,23,42,0.16)" : "none"}
          />
        )}
        <ellipse className="fill-foreground" cx="24.5" cy="28.5" rx="4.2" ry="6.4" />
        <ellipse className="fill-foreground" cx="39.5" cy="28.5" rx="4.2" ry="6.4" />
      </svg>
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

function isLightFill(fill: string): boolean {
  if (fill.startsWith("#")) {
    const hex =
      fill.length === 4 ? `#${fill[1]}${fill[1]}${fill[2]}${fill[2]}${fill[3]}${fill[3]}` : fill;
    const value = Number.parseInt(hex.slice(1, 7), 16);
    if (Number.isNaN(value)) return false;
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 180;
  }
  return ["white", "ivory", "snow", "whitesmoke", "ghostwhite", "azure"].includes(
    fill.toLowerCase(),
  );
}
