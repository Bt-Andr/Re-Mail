# @re-mail/design-tokens

Shared design tokens (colors, status colors, typography, icons) consumed by
`web/`, `mobile/`, and (once it exists) `webmail/`.

> **Status: real values.** All exports below hold the actual, agreed-canonical
> token values (colors ported from `web/src/index.css`, status mapping decided
> in favor of web's over mobile's prior divergent one, typography/icon scale
> per the product owner's spec). Consumers are not yet wired up to import
> these — that's a later track's job (mobile's `tailwind.config.js` /
> `ThreadListItem.tsx` etc, and web/webmail's `Badge.tsx` / `index.css`).

No build step — this package is consumed as source directly. Both Vite
(`web/`) and Metro (`mobile/`) transpile TypeScript from workspace packages
on the fly, so there's nothing to compile or publish here.

## Exports contract

- `@re-mail/design-tokens` → `src/index.ts`, re-exporting everything from
  `src/colors.ts`, `src/status.ts`, `src/typography.ts`, `src/icons.ts`:

  ```ts
  import {
    colors,           // { light: {...}, dark: {...} } — hsl(...) strings, RN-ready
    colorTokens,       // raw "H S% L%" triplets per semantic name (light+dark pair)
    radius,            // "0.625rem"
    statusColors,       // StatusKey -> { family, className, hex } (threads + invites)
    statusClassName,     // StatusKey -> Tailwind className string only
    statusColorFallback,  // unknown-status fallback (matches Badge.tsx's 'gray')
    typography,            // scale keys -> { fontSize, lineHeight, fontWeight, ... } (px numbers)
    typographyTailwindFontSize, // typography reshaped into Tailwind's fontSize theme format
    icons,                  // iconSize-style map: nav/inlineStatus/swipeAction/avatar/minTouchTarget
  } from "@re-mail/design-tokens";
  ```

- `@re-mail/design-tokens/tailwind-preset` → `tailwind-preset.cjs`
  A Tailwind v3 preset, for apps that want the tokens available as Tailwind
  theme values (semantic `colors.*` wired to `hsl(var(--x))` CSS vars, plus a
  `fontSize` scale matching `typography.ts`). Add it to a consuming app's
  `tailwind.config.js`:

  ```js
  module.exports = {
    presets: [require("@re-mail/design-tokens/tailwind-preset")],
    // ...
  };
  ```

  Kept as plain `.cjs` (not `.ts`) so Tailwind's own config loader can
  `require()` it regardless of the consuming app's `"type"` field. **This
  means its color/fontSize values are hand-duplicated from `src/colors.ts` /
  `src/typography.ts`, not generated from them** — Tailwind's config loader is
  a plain CommonJS `require`, so it can't load TypeScript/ESM sources
  directly, and this package intentionally ships with no build step in v1
  (see the plan doc, §2). If you change a color or type-scale value, update
  both the `.ts` source *and* `tailwind-preset.cjs` — each file has a comment
  at the top pointing at its counterpart as a reminder. Status colors
  (`bg-amber-500/10` etc) are the one exception: they use Tailwind's own stock
  palette directly, so there's nothing to duplicate for those.

- `css-vars.css` (no package export yet — import by relative/workspace path
  once a consumer needs it) holds the canonical HSL `:root` / `.dark`
  variable block, matching `colorTokens` in `src/colors.ts` value-for-value.
  It replaces the copy currently hand-duplicated in `web/src/index.css`
  (lines ~30-84) — not yet wired up; `web/src/index.css` is untouched by this
  track since another track is actively working in that file's tree.

## Status color mapping

Canonical (per product decision): `nouveau`/`PENDING` = amber,
`en_cours` = blue, `resolu`/`ACTIVATED` = emerald/green, `REVOKED` = red.
This matches `web/src/components/ui/Badge.tsx`'s `statusBadgeColor()` exactly
(mobile's previously-divergent `STATUS_CLASS` in `ThreadListItem.tsx` is
reconciled toward this file by a later track, not the other way around).

## Verifying this package in isolation

```bash
# From repo root:
node -e "console.log(require('./packages/design-tokens/tailwind-preset.cjs'))"
npx tsc --noEmit packages/design-tokens/src/index.ts
```
