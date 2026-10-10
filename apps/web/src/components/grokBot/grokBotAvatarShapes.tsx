import type { ReactNode } from "react";

/** Grok Bot's avatar vocabulary: 25 body silhouettes and 11 colors. */
export const GROK_BOT_AVATAR_KINDS = [
  "blob",
  "pebble",
  "bean",
  "egg",
  "squircle",
  "tablet",
  "capsule",
  "cylinder",
  "hex",
  "gem",
  "crystal",
  "wedge",
  "shield",
  "dome",
  "arch",
  "cloud",
  "teardrop",
  "leaf",
  "square",
  "sparkle",
  "clover",
  "flower",
  "heart",
  "house",
  "star",
] as const;
export type GrokBotAvatarKind = (typeof GROK_BOT_AVATAR_KINDS)[number];

export const GROK_BOT_AVATAR_COLORS = {
  black: "#000000",
  brown: "#936439",
  red: "#ff263c",
  orange: "#ff6700",
  yellow: "#ff9800",
  green: "#00c972",
  cyan: "#00bca6",
  blue: "#1084fe",
  violet: "#9159fe",
  magenta: "#ff309b",
  gray: "#777777",
} as const;

/** Legacy and informal names that roster data may still use. */
export const GROK_BOT_AVATAR_KIND_ALIASES: Readonly<Record<string, GrokBotAvatarKind>> = {
  circle: "blob",
  round: "blob",
  oval: "blob",
  triangle: "wedge",
  pyramid: "wedge",
  cone: "wedge",
  puff: "cloud",
  diamond: "gem",
  rhombus: "gem",
};

export const GROK_BOT_AVATAR_COLOR_ALIASES: Readonly<Record<string, string>> = {
  purple: GROK_BOT_AVATAR_COLORS.violet,
  pink: GROK_BOT_AVATAR_COLORS.magenta,
  grey: GROK_BOT_AVATAR_COLORS.gray,
  teal: GROK_BOT_AVATAR_COLORS.cyan,
};

type Layout = {
  /** Eye pair center in the 64-unit body box. */
  readonly eyeX?: number;
  readonly eyeY: number;
  /** Degrees; eyes lean with the silhouette (leaf, bean). */
  readonly tilt?: number;
};

const ROUND = { strokeLinejoin: "round", strokeLinecap: "round" } as const;

/**
 * Polygons get their rounded corners from a same-colored stroke, so `points`
 * are inset by half of `width` from the visible edge.
 */
function Rounded({ d, width = 8 }: { readonly d: string; readonly width?: number }) {
  return <path d={d} stroke="currentColor" strokeWidth={width} {...ROUND} />;
}

export const GROK_BOT_AVATAR_SHAPES: Readonly<
  Record<GrokBotAvatarKind, { readonly layout: Layout; readonly body: ReactNode }>
> = {
  blob: {
    layout: { eyeY: 33 },
    body: <path d="M32 9c13 0 23 9 23 23 0 13-9 24-23 24S9 45 9 32C9 18 19 9 32 9Z" />,
  },
  pebble: {
    layout: { eyeY: 35 },
    body: <path d="M31 13c13-1 25 5 27 18 2 13-8 22-24 22-15 0-27-5-27-17C7 24 17 13 31 13Z" />,
  },
  bean: {
    layout: { eyeY: 32, tilt: -10 },
    body: <rect x="9" y="14" width="46" height="36" rx="18" transform="rotate(-10 32 32)" />,
  },
  egg: {
    layout: { eyeY: 38 },
    body: <path d="M32 7c13 0 22 22 22 33 0 10-9 17-22 17S10 50 10 40C10 29 19 7 32 7Z" />,
  },
  squircle: {
    layout: { eyeY: 32 },
    body: <rect x="8" y="8" width="48" height="48" rx="19" />,
  },
  tablet: {
    layout: { eyeY: 28 },
    body: <rect x="14" y="7" width="36" height="50" rx="11" />,
  },
  capsule: {
    layout: { eyeY: 26 },
    body: <rect x="16" y="5" width="32" height="54" rx="16" />,
  },
  cylinder: {
    layout: { eyeY: 36 },
    body: (
      <>
        <rect x="11" y="10" width="42" height="46" rx="13" />
        <ellipse cx="32" cy="18" rx="21" ry="8" className="fill-white" opacity="0.14" />
      </>
    ),
  },
  hex: {
    layout: { eyeY: 32 },
    body: <Rounded d="M32 12 49 22v20L32 52 15 42V22Z" width={10} />,
  },
  gem: {
    layout: { eyeY: 28 },
    body: <Rounded d="M20 14h24l11 14-23 24L9 28Z" width={9} />,
  },
  crystal: {
    layout: { eyeY: 32 },
    body: <Rounded d="M32 11 47 24v20L32 54 17 44V24Z" width={9} />,
  },
  wedge: {
    layout: { eyeY: 41 },
    body: <Rounded d="M32 13 52 48H12Z" width={12} />,
  },
  shield: {
    layout: { eyeY: 29 },
    body: <Rounded d="M15 15h34v18c0 9-8 15-17 19-9-4-17-10-17-19Z" width={10} />,
  },
  dome: {
    layout: { eyeY: 35 },
    body: <Rounded d="M13 51V35c0-12 8-21 19-21s19 9 19 21v16Z" width={10} />,
  },
  arch: {
    layout: { eyeY: 28 },
    body: <path d="M9 57V30C9 15 19 6 32 6s23 9 23 24v27H42V47c0-6-4-9-10-9s-10 3-10 9v10Z" />,
  },
  cloud: {
    layout: { eyeY: 37 },
    body: (
      <>
        <circle cx="20" cy="35" r="13" />
        <circle cx="33" cy="26" r="16" />
        <circle cx="46" cy="34" r="13" />
        <rect x="7" y="34" width="50" height="19" rx="9.5" />
      </>
    ),
  },
  teardrop: {
    layout: { eyeY: 41 },
    body: <path d="M32 6c9 12 21 24 21 36 0 10-9 17-21 17S11 52 11 42C11 30 23 18 32 6Z" />,
  },
  leaf: {
    layout: { eyeX: 31, eyeY: 36, tilt: -8 },
    body: <path d="M49 6c8 22 5 42-13 50C18 63 6 48 10 32 14 17 30 8 49 6Z" />,
  },
  square: {
    layout: { eyeY: 32 },
    body: <rect x="9" y="9" width="46" height="46" rx="7" />,
  },
  sparkle: {
    layout: { eyeY: 32 },
    body: <path d="M32 3C36 20 44 28 61 32 44 36 36 44 32 61 28 44 20 36 3 32 20 28 28 20 32 3Z" />,
  },
  clover: {
    layout: { eyeY: 32 },
    body: (
      <>
        <circle cx="22" cy="22" r="14" />
        <circle cx="42" cy="22" r="14" />
        <circle cx="22" cy="42" r="14" />
        <circle cx="42" cy="42" r="14" />
        <rect x="18" y="18" width="28" height="28" />
      </>
    ),
  },
  flower: {
    layout: { eyeY: 32 },
    body: (
      <>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <circle key={angle} cx="32" cy="15" r="11" transform={`rotate(${angle} 32 32)`} />
        ))}
        <circle cx="32" cy="32" r="17" />
      </>
    ),
  },
  heart: {
    layout: { eyeY: 28 },
    body: (
      <path d="M32 57C11 41 6 30 6 21 6 13 12 7 20 7c5 0 9 3 12 8 3-5 7-8 12-8 8 0 14 6 14 14 0 9-5 20-26 36Z" />
    ),
  },
  house: {
    layout: { eyeY: 40 },
    body: <Rounded d="M32 12 51 27v25H13V27Z" width={10} />,
  },
  star: {
    layout: { eyeY: 35 },
    body: (
      <Rounded
        d="m32 10 6.5 14 15.2 1.8-11.3 10.4 3 15L32 43.5 18.6 51.2l3-15L10.3 25.8 25.5 24Z"
        width={8}
      />
    ),
  },
};

export function grokBotEyeLayout(kind: GrokBotAvatarKind) {
  const { eyeX = 32, eyeY, tilt = 0 } = GROK_BOT_AVATAR_SHAPES[kind].layout;
  return { eyeX, eyeY, tilt };
}
