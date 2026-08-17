# Deployment notes — monorepo restructuring

The repo root now has npm workspaces (`packages/*`, `web`, `mobile`). This
changes how installs must happen for deployed apps, since a plain
`npm install` inside `web/` or `mobile/` alone will no longer produce a
correct `node_modules` for workspace-linked packages like
`@re-mail/design-tokens`. The following need manual attention outside this
repo — not something achievable from the codebase alone:

## Vercel (`web/`, and later `webmail/`)

- The Vercel project's install step needs to run from the **workspace
  root**, not just the `web/` subfolder, so npm can resolve workspace
  packages and produce the consolidated root `package-lock.json`.
- Concretely this likely means adjusting the project's "Root Directory" /
  install command / build command settings (exact fields depend on
  Vercel's current UI, not verified here) so that:
  - install runs at the repo root (`npm install`), and
  - build still targets `web/` (e.g. `npm run build --workspace=web`, or
    equivalent `cd web && npm run build` after a root-level install).
- Once `webmail/` exists as a workspace member, it will need the same
  treatment as its own separate Vercel project.

## Expo / EAS (`mobile/`)

- EAS builds currently assume `mobile/` is self-contained. With workspace
  hoisting, dependencies (including `@re-mail/design-tokens`) may now live
  in the root `node_modules` rather than `mobile/node_modules`.
- EAS config (`mobile/eas.json`) and/or the Expo project settings likely
  need to be made monorepo-aware — e.g. confirming the build runs from (or
  is aware of) the repo root so the install step sees the workspace
  `package-lock.json`, not just `mobile/`'s old standalone lockfile (now
  deleted).
- Not verified against EAS's current documented monorepo support — check
  Expo's docs for the current recommended setup before changing build
  profiles.

## Not done here

No dashboard/project settings were changed — this file is a checklist for
a human with access to the Vercel and Expo/EAS dashboards.
