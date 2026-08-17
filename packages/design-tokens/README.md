# @re-mail/design-tokens

Shared design tokens (colors, status colors, typography, icons) consumed by
`web/`, `mobile/`, and (once it exists) `webmail/`.

> **Status: skeleton only.** Every export currently resolves to an empty
> placeholder object. This package exists so other tracks/apps can wire up
> the import paths now; a follow-up track fills in the real token values
> (including porting the HSL variables from `web/src/index.css`).

No build step — this package is consumed as source directly. Both Vite
(`web/`) and Metro (`mobile/`) transpile TypeScript from workspace packages
on the fly, so there's nothing to compile or publish here.

## Exports contract

- `@re-mail/design-tokens` → `src/index.ts`
  Plain JS/TS values: `colors`, `statusColors`, `typography`, `icons`.

  ```ts
  import { colors, statusColors, typography, icons } from "@re-mail/design-tokens";
  ```

- `@re-mail/design-tokens/tailwind-preset` → `tailwind-preset.cjs`
  A Tailwind v3 preset, for apps that want the tokens available as Tailwind
  theme values. Add it to a consuming app's `tailwind.config.js`:

  ```js
  module.exports = {
    presets: [require("@re-mail/design-tokens/tailwind-preset")],
    // ...
  };
  ```

  Kept as plain `.cjs` (not `.ts`) so Tailwind's own config loader can
  `require()` it regardless of the consuming app's `"type"` field.

- `css-vars.css` (no package export yet — import by relative/workspace path
  once populated) will hold the canonical HSL `:root` / `.dark` variable
  block, replacing the copy currently hand-duplicated in
  `web/src/index.css` (lines ~30-84).

## Not yet done

All files under `src/`, `tailwind-preset.cjs`, and `css-vars.css` contain
stub/placeholder content only. Do not treat any exported value as final
until a follow-up track populates real tokens.
