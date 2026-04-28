---
name: package-upgrades-april-2026
description: Major package upgrades applied in April 2026, breaking changes fixed, and decisions made about ESLint 10 compatibility
type: project
---

In April 2026 the following major version bumps were applied to `client/package.json`:

- `i18next` 25 → 26
- `react-i18next` 16 → 17
- `next-i18next` 15 → 16 — Breaking: Pages Router API moved to subpaths (see project_architecture.md)
- `next-seo` 6 → 7 — Breaking: `<NextSeo>` component replaced by `generateNextSeo()` function for Pages Router
- `schema-dts` 1 → 2 — Type-only, no code changes needed
- `typescript` 5.9 → 6.0
- `typescript-eslint` / `@typescript-eslint/*` 8.59.0 → 8.59.1

**ESLint 10 was NOT upgraded** — `eslint-plugin-react` v7 and `eslint-plugin-import` v2 are incompatible with ESLint 10 (the ecosystem hasn't caught up). Project stays on ESLint 9.39.4.

**Yarn resolutions added**: `"@typescript-eslint/utils": "^8.59.1"` in `package.json` — needed to prevent `eslint-plugin-jest` from using its bundled older `@typescript-eslint/utils@8.35.0` which was incompatible.

**SASS fixes**: Changed `@import` to `@use` in two filter-panel SASS files, and quoted `@each $tier in 'bronze', 'silver', 'gold'` (unquoted values were misinterpreted as CSS color values).

**Why:** Upgrade was routine maintenance to stay current with dependencies.
**How to apply:** When writing i18n code, always use `next-i18next/pages` subpath. When writing SEO tags, use `generateNextSeo` not `<NextSeo>`. Don't attempt to upgrade ESLint beyond 9.x until the plugin ecosystem supports v10.
