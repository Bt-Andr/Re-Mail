// Tailwind v3 preset — kept as plain .cjs (not .ts) so Tailwind's own config loader
// can require() it independent of any consuming app's "type": "module" setting.
//
// SYNC CAVEAT: this file cannot `require()` the TypeScript sources in src/ (Tailwind's
// config loader is a plain CommonJS `require`, no TS/ESM support), so the values below
// are hand-duplicated from src/colors.ts, src/status.ts and src/typography.ts. If you
// change a value in one place, change it in the other. There is no build step in this
// package (intentionally, v1) to keep these in sync automatically.
//
// - colors: semantic HSL custom properties, from src/colors.ts's `colorTokens`
//   (itself ported from web/src/index.css's :root/.dark block). Referenced as
//   `hsl(var(--x))` so the actual light/dark values still live in one CSS file
//   (css-vars.css) — this preset only wires the Tailwind *names* to those CSS vars,
//   it doesn't hardcode light/dark hex here.
// - fontSize: from src/typography.ts's `typography` scale.
// - status colors (amber/blue/emerald/red) are NOT added as custom Tailwind color
//   names here — src/status.ts's `statusColors[...].className` already uses
//   Tailwind's own stock palette (`bg-amber-500/10`, etc), which every consumer
//   already has for free. Nothing to extend for that part.

module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 3px)",
        sm: "calc(var(--radius) - 5px)",
      },
      fontSize: {
        // key: [fontSize, { lineHeight, fontWeight, letterSpacing? }]
        // Mirrors src/typography.ts's `typography` scale exactly.
        senderUnread: ["16px", { lineHeight: "20px", fontWeight: "600" }],
        senderRead: ["16px", { lineHeight: "20px", fontWeight: "400" }],
        subject: ["16px", { lineHeight: "20px", fontWeight: "400" }],
        subjectUnread: ["16px", { lineHeight: "20px", fontWeight: "600" }],
        preview: ["14px", { lineHeight: "18px", fontWeight: "400" }],
        timestamp: ["13px", { lineHeight: "16px", fontWeight: "400" }],
        body: ["17px", { lineHeight: "26px", fontWeight: "400" }],
        sectionHeader: [
          "12px",
          { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.4px" },
        ],
      },
    },
  },
};
