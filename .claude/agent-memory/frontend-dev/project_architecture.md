---
name: geometki-client-architecture
description: Core architecture, stack, and patterns used in the geometki Next.js client
type: project
---

Next.js 16 (Pages Router) with React 19. TypeScript throughout.

**State management**: Redux Toolkit + RTK Query. Store is in `api/store.ts`, API definitions in `api/api.ts`. SSR hydration uses `next-redux-wrapper`. There are two API instances: `API` (main backend) and `APIPastvu` (pastvu.com historical photos).

**Styling**: SASS modules per component (`styles.module.sass`). Global styles in `styles/globals.sass`. Theme variables via CSS custom properties. Two theme files: `styles/dark.css` and `styles/light.css`. Theme switching via `next-themes`.

**i18n**: `next-i18next` with two locales: `ru` (default) and `en`. Translation keys are namespaced by component path (e.g. `components.app-layout`). Scanner config in `i18next-scanner.config.js`.

**Map**: Leaflet + react-leaflet v5, loaded client-side only via `next/dynamic` with `ssr: false`. `InteractiveMap` is the monolithic map component in `components/common/interactive-map/`.

**Authentication**: JWT token stored in localStorage via a custom `localstorage.ts` wrapper. Cookie `token` is also set (to boolean `true` — a known bug) for middleware route-guarding. Auth state lives in `api/authSlice.ts`. A polling `AppAuthChecker` component refreshes auth state every 60s.

**Component layout**:
- `components/common/` — shared layout components (AppLayout, PhotoGallery, Rating, etc.)
- `components/ui/` — generic UI primitives (Autocomplete, Pagination, Carousel, etc.)
- `components/pages/` — page-specific compound components (place/, user/, categories/, tags/)

**Testing**: Jest + jsdom. Test files are co-located with source. Test suites added: `helpers.test.ts`, `coordinates.test.ts`, `validators.test.ts`, `localstorage.test.ts`, `authSlice.test.ts`, `applicationSlice.test.ts`, `notificationSlice.test.ts`, `Pagination.test.ts`. When a component imports UI library deps (e.g. `simple-react-ui-kit`) that are not in `moduleNameMapper`, extract pure logic into a separate utility file (e.g. `paginationUtils.ts`) and import from there in the test.

**i18n scanner**: `yarn locales:build` runs `i18next-scanner` which requires all translation keys to be dot-separated (`group.key`). Pre-existing flat keys in `common.json` cause scanner failures — this is a known pre-existing issue unrelated to new work. New keys should always be dot-separated.

**`AnyAction` deprecated**: `api/store.ts` uses `UnknownAction` (not `AnyAction`) from `@reduxjs/toolkit`.

**Why:** Summarises the entire client codebase structure for quick context in future sessions.
**How to apply:** Use when suggesting refactors, new features, or bug fixes to stay consistent with existing patterns.
