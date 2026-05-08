---
name: package-upgrades
description: Package upgrades history: April and May 2026 — breaking changes fixed and ESLint 10 decision
type: project
---

## April 2026 — Major version bumps

The following major version bumps were applied to `client/package.json`:

- `i18next` 25 → 26
- `react-i18next` 16 → 17
- `next-i18next` 15 → 16 — Breaking: Pages Router API moved to subpaths (see project_architecture.md)
- `next-seo` 6 → 7 — Breaking: `<NextSeo>` component replaced by `generateNextSeo()` function for Pages Router
- `schema-dts` 1 → 2 — Type-only, no code changes needed
- `typescript` 5.9 → 6.0 (6.0.3 is now the stable `latest` tag)
- `typescript-eslint` / `@typescript-eslint/*` 8.59.0 → 8.59.1

**SASS fixes**: Changed `@import` to `@use` in two filter-panel SASS files, and quoted `@each $tier in 'bronze', 'silver', 'gold'` (unquoted values were misinterpreted as CSS color values).

**Yarn resolutions added**: `"@typescript-eslint/utils": "^8.59.1"` in `package.json` — needed to prevent `eslint-plugin-jest` from using its bundled older `@typescript-eslint/utils@8.35.0` which was incompatible.

## May 2026 — Patch/minor bumps

Applied via `yarn install` after editing `package.json` directly:

- `react` / `react-dom`: 19.2.5 → 19.2.6
- `next`: 16.2.4 → 16.2.6
- `i18next`: ^26.0.8 → ^26.0.10
- `react-i18next`: ^17.0.6 → ^17.0.7
- `yet-another-react-lightbox`: ^3.31.0 → ^3.32.0
- `@eslint/compat`: ^2.0.5 → ^2.1.0
- `@next/eslint-plugin-next`: ^16.2.4 → ^16.2.6
- `@typescript-eslint/*` + `typescript-eslint`: ^8.59.1 → ^8.59.2
- `eslint-plugin-eslint-plugin`: ^7.3.2 → ^7.3.3
- `jest` / `jest-environment-jsdom`: ^30.3.0 → ^30.4.1
- `globals`: ^17.5.0 → ^17.6.0
- `@types/node`: 24.12.2 → 20.19.40 (fixed to match Node 20 engine requirement)
- `resolutions["@typescript-eslint/utils"]` bumped to `^8.59.2`

No code changes were required — all updates were non-breaking.

## Standing decisions

**ESLint 10 was NOT upgraded** — `eslint-plugin-react` v7 and `eslint-plugin-import` v2 are incompatible with ESLint 10 (the ecosystem hasn't caught up). Project stays on ESLint 9.x.

**Why:** Routine maintenance to stay current with dependencies.
**How to apply:** When writing i18n code, always use `next-i18next/pages` subpath. When writing SEO tags, use `generateNextSeo` not `<NextSeo>`. Don't attempt to upgrade ESLint beyond 9.x until the plugin ecosystem supports v10.
