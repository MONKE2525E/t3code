/** Grok Bot's avatar vocabulary: 25 bodies and 11 colors. The engine draws them. */
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
