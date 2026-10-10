import { GROK_BOT_AVATAR_COLORS, GROK_BOT_AVATAR_KINDS } from "./grokBotAvatarShapes";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import { GrokBotAvatar } from "./GrokBotAvatar";
import { resolveGrokBotAvatarKind } from "./grokBotPresentation";

/**
 * The avatar as a button: opens the shape and color pickers, like the Grok Bot
 * app's character editor. The caller applies each choice and spins the bot.
 */
export function GrokBotAppearancePicker({
  shape,
  color,
  name,
  spinSignal,
  disabled = false,
  onSelectShape,
  onSelectColor,
}: {
  readonly shape: string;
  readonly color: string;
  readonly name: string;
  readonly spinSignal: number;
  readonly disabled?: boolean;
  readonly onSelectShape: (shape: string) => void;
  readonly onSelectColor: (color: string) => void;
}) {
  const currentShape = resolveGrokBotAvatarKind(shape);
  const currentColor = color.trim().toLowerCase();
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`Change ${name}'s look`}
        render={
          <button
            type="button"
            className="cursor-pointer rounded-2xl p-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-64"
          />
        }
      >
        <GrokBotAvatar
          bot={{ name, avatarShape: shape, avatarColor: color }}
          size="xl"
          spinSignal={spinSignal}
        />
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-80">
        <div className="flex flex-col gap-3 p-1">
          <div role="group" aria-label="Shape" className="grid grid-cols-5 gap-1">
            {GROK_BOT_AVATAR_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                aria-pressed={kind === currentShape}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  kind === currentShape && "bg-accent ring-1 ring-inset ring-ring",
                )}
                onClick={() => onSelectShape(kind)}
              >
                <GrokBotAvatar
                  bot={{ name: kind, avatarShape: kind, avatarColor: color }}
                  size="sm"
                />
              </button>
            ))}
          </div>
          <div role="group" aria-label="Color" className="flex justify-between gap-1">
            {Object.entries(GROK_BOT_AVATAR_COLORS).map(([id, hex]) => (
              <button
                key={id}
                type="button"
                aria-label={id}
                aria-pressed={id === currentColor}
                className={cn(
                  "size-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  id === "black" && "border border-border",
                  id === currentColor && "ring-2 ring-inset ring-foreground/70",
                )}
                style={{ backgroundColor: id === "black" ? "var(--foreground)" : hex }}
                onClick={() => onSelectColor(id)}
              />
            ))}
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
