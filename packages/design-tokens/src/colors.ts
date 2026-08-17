// Canonical semantic UI colors (light/dark), ported verbatim from the hand-authored
// HSL :root / .dark block in web/src/index.css (the `@layer base` rule, lines ~30-84
// as of this writing). That block is the most mature existing token set in the
// codebase — treated here as the source of truth rather than inventing a new palette.
//
// This file does NOT modify web/src/index.css (a parallel track owns that tree while
// it's being split into web/ + webmail/); it's a canonical copy. css-vars.css in this
// package carries the same values forward as an actual CSS custom-property block.

export type SemanticColorName =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "destructiveForeground"
  | "border"
  | "input"
  | "ring";

interface SemanticColorPair {
  /** Raw "H S% L%" triplet (no `hsl(...)` wrapper) — the literal CSS custom-property value. */
  light: string;
  dark: string;
}

/**
 * Raw HSL triplets, exactly as they appear in web/src/index.css's :root/.dark block.
 * This is the canonical form: used verbatim as CSS custom-property values (see
 * css-vars.css) and as the source for the `hsl(...)`-wrapped `colors` export below,
 * which plain-JS consumers (React Native color/style props, no CSS vars available)
 * can use directly.
 */
export const colorTokens: Record<SemanticColorName, SemanticColorPair> = {
  background: { light: "0 0% 100%", dark: "0 0% 5%" },
  foreground: { light: "0 0% 9%", dark: "0 0% 95%" },

  card: { light: "0 0% 100%", dark: "0 0% 7%" },
  cardForeground: { light: "0 0% 9%", dark: "0 0% 95%" },

  primary: { light: "0 0% 9%", dark: "0 0% 95%" },
  primaryForeground: { light: "0 0% 100%", dark: "0 0% 9%" },

  secondary: { light: "0 0% 96%", dark: "0 0% 13%" },
  secondaryForeground: { light: "0 0% 9%", dark: "0 0% 95%" },

  muted: { light: "0 0% 96%", dark: "0 0% 13%" },
  mutedForeground: { light: "0 0% 45%", dark: "0 0% 60%" },

  accent: { light: "0 0% 94%", dark: "0 0% 16%" },
  accentForeground: { light: "0 0% 9%", dark: "0 0% 95%" },

  destructive: { light: "0 72% 51%", dark: "0 63% 55%" },
  destructiveForeground: { light: "0 0% 100%", dark: "0 0% 100%" },

  border: { light: "0 0% 89%", dark: "0 0% 17%" },
  input: { light: "0 0% 87%", dark: "0 0% 20%" },
  ring: { light: "0 0% 9%", dark: "0 0% 83%" },
};

/** Border radius base, ported from web/src/index.css's `--radius: 0.625rem`. */
export const radius = "0.625rem";

function hsl(triplet: string): string {
  return `hsl(${triplet})`;
}

function mapPalette(mode: "light" | "dark"): Record<SemanticColorName, string> {
  return Object.fromEntries(
    Object.entries(colorTokens).map(([name, pair]) => [name, hsl(pair[mode])])
  ) as Record<SemanticColorName, string>;
}

/**
 * Plain JS/TS values, ready to use as a React Native `color`/`backgroundColor` prop
 * or inline style — no CSS variables involved. RN's color parser accepts `hsl(...)`
 * strings directly, so no further conversion is needed at the call site.
 *
 * Usage: `colors.light.primary`, `colors.dark.mutedForeground`, etc. Pick `light` or
 * `dark` based on the consumer's own color-scheme detection (e.g. NativeWind's
 * `useColorScheme()`), since RN has no `.dark` class mechanism.
 */
export const colors = {
  light: mapPalette("light"),
  dark: mapPalette("dark"),
};
