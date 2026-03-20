---
name: geometki-client-architecture
description: Core architecture, stack, and patterns used in the geometki Next.js client (post March 2026 refactor)
type: project
---

Next.js 16 (Pages Router) with React 19. TypeScript throughout.

**State management**: Redux Toolkit + RTK Query. Store is in `app/store.ts` (moved from `api/store.ts`). Redux slices in `app/applicationSlice.ts`, `app/authSlice.ts`, `app/notificationSlice.ts`. API definitions in `api/api.ts` (monolithic — all endpoints in one file; the injectEndpoints split is not viable without updating all ~40 consumers). SSR hydration uses `next-redux-wrapper`. Two API instances: `API` (main backend) and `APIPastvu` (pastvu.com historical photos).

**Directory structure** (post refactor, as of commit 786dbd4e on develop):
- `app/` — Redux store + slices
- `api/` — RTK Query API slice (`api.ts`), types (`types/`), models (`models/`), `apiPastvu.ts`
- `config/` — `constants.ts` (LOCAL_STORAGE), `env.ts` (IMG_HOST, SITE_LINK, API_HOST)
- `hooks/` — custom React hooks (`useLocalStorage.ts`, `useClientOnly.ts`)
- `utils/` — pure utility functions split by domain: `date.ts`, `text.ts`, `number.ts`, `url.ts`, `array.ts`, `api.ts` (isApiValidationErrors), `pagination.ts`, `localstorage.ts`, `schema.ts`, `address.ts`, `coordinates.ts`, `validators.ts`; barrel re-export in `helpers.ts`
- `features/` — domain co-location: `features/<domain>/` contains `<domain>.types.ts` (re-exports from `api/types/`) and `<domain>.utils.ts` (domain utilities). NOT used for API splitting.
- `components/layout/` — app-level layout (AppLayout, AppBar, Snackbar, etc.)
- `components/map/` — Leaflet map components (InteractiveMap, MarkerPoint, etc.)
- `components/shared/` — shared UI components (PhotoGallery, BookmarkButton, UserAvatar, etc.)
- `components/ui/` — generic UI primitives (Autocomplete, Pagination, Carousel, etc.)
- `sections/` — page-specific compound components (place/, user/, categories/, tags/) — formerly `components/pages/`
- `pages/` — Next.js route entry points
- `styles/` — `globals.sass` (global classes + contextListMenu), `variables.sass` (SASS vars + %placeBottomPanel placeholder), `dark.css`, `light.css`

**Styling**: SASS modules per component (`styles.module.sass`). Theme via CSS custom properties. SASS placeholder `%placeBottomPanel` in `variables.sass` (use `@extend %placeBottomPanel` after `@use`-ing variables). Global utility classes (`.contextListMenu`, `.emptyList`, etc.) in `globals.sass`.

**Import paths for common things**:
- Store hooks: `import { useAppDispatch, useAppSelector } from '@/app/store'`
- API: `import { API, ApiModel, ApiType } from '@/api'`
- Env constants: `import { IMG_HOST, SITE_LINK } from '@/config/env'`
- Validation helper: `import { isApiValidationErrors } from '@/utils/api'`

**i18n**: `next-i18next` with two locales: `ru` (default) and `en`. Run `yarn locales:build` after adding translation keys (always dot-separated).

**Map**: Leaflet + react-leaflet v5, loaded client-side only via `next/dynamic` with `ssr: false`.

**Authentication**: JWT token in localStorage. Auth state in `app/authSlice.ts`. `AppAuthChecker` polls every 60s.

**Testing**: Jest + jsdom. Test files co-located with source. All 8 suites, 211 tests pass as of the March 2026 refactor.

**Why:** Summarises the entire client codebase structure for quick context in future sessions.
**How to apply:** Use when suggesting refactors, new features, or bug fixes to stay consistent with existing patterns.
