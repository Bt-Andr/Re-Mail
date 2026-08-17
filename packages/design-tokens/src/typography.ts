// Type scale, encoding the exact values the product owner specified (see plan doc
// §"Design values already specified by the product owner"). Concrete numbers below
// are the upper bound of each given range (e.g. "15-16px" -> 16), except where the
// spec already gave a single value.
//
// Each entry carries plain numbers (fontSize/lineHeight in px, no unit) so it can be
// consumed directly by React Native `StyleSheet`/inline styles, AND is shaped so it
// can be transformed into Tailwind v3's fontSize theme format:
//   { key: [fontSize, { lineHeight, fontWeight, letterSpacing? }] }
// (Tailwind v3 accepts either `[size, lineHeight]` or `[size, { lineHeight, fontWeight,
// letterSpacing }]` for each fontSize entry — see tailwind-preset.cjs, which duplicates
// these values in plain CommonJS since it can't `require()` this .ts file directly.)

export type FontWeightToken = "400" | "600";

export interface TypeScaleEntry {
  /** px, unitless number — use directly in RN StyleSheet, append "px" for CSS/Tailwind. */
  fontSize: number;
  /** px, unitless number. */
  lineHeight: number;
  fontWeight: FontWeightToken;
  /** px, unitless number. Only set where the spec calls for it (section headers). */
  letterSpacing?: number;
  textTransform?: "uppercase";
}

export const typography = {
  /** Sender name in the thread list, unread state. 16px/600/20px. */
  senderUnread: { fontSize: 16, lineHeight: 20, fontWeight: "600" },
  /** Sender name in the thread list, read state. 16px/400/20px. */
  senderRead: { fontSize: 16, lineHeight: 20, fontWeight: "400" },
  /** Subject line, read state (thread not unread). 16px/400/20px. */
  subject: { fontSize: 16, lineHeight: 20, fontWeight: "400" },
  /** Subject line, unread state — goes semibold, same size/line-height as `subject`. */
  subjectUnread: { fontSize: 16, lineHeight: 20, fontWeight: "600" },
  /** Preview/snippet text under the subject. 14px/400/18px. */
  preview: { fontSize: 14, lineHeight: 18, fontWeight: "400" },
  /** Timestamp / metadata text. 13px/400/16px. */
  timestamp: { fontSize: 13, lineHeight: 16, fontWeight: "400" },
  /** Body text in the reading view. 17px/400/26px (~1.53x, within the specified ~1.5x). */
  body: { fontSize: 17, lineHeight: 26, fontWeight: "400" },
  /** Section headers ("aujourd'hui", "hier"...). 12px/600/16px, uppercase, slight tracking. */
  sectionHeader: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TypeScaleEntry>;

export type TypographyKey = keyof typeof typography;

/**
 * `typography`, reshaped into Tailwind v3's `theme.fontSize` extension format:
 * `{ key: [fontSize, { lineHeight, fontWeight, letterSpacing? }] }`. Spread this
 * into a Tailwind config's `theme.extend.fontSize` (see tailwind-preset.cjs for the
 * hand-duplicated CommonJS equivalent — this .ts value isn't reachable from a plain
 * `require()`d .cjs file).
 */
export const typographyTailwindFontSize: Record<
  TypographyKey,
  [string, { lineHeight: string; fontWeight: FontWeightToken; letterSpacing?: string }]
> = Object.fromEntries(
  Object.entries(typography).map(([key, entry]) => [
    key,
    [
      `${entry.fontSize}px`,
      {
        lineHeight: `${entry.lineHeight}px`,
        fontWeight: entry.fontWeight,
        ...("letterSpacing" in entry && entry.letterSpacing !== undefined
          ? { letterSpacing: `${entry.letterSpacing}px` }
          : {}),
      },
    ],
  ])
) as Record<TypographyKey, [string, { lineHeight: string; fontWeight: FontWeightToken; letterSpacing?: string }]>;
