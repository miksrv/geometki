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

**i18n**: `next-i18next` v16 with two locales: `ru` (default) and `en`. Pages Router API is under subpaths — import `appWithTranslation`, `useTranslation`, `Trans` from `'next-i18next/pages'`; import `serverSideTranslations` from `'next-i18next/pages/serverSideTranslations'`. Run `yarn locales:build` after adding translation keys (always dot-separated).

**next-seo**: v7. Pages Router uses `generateNextSeo({...})` function (not `<NextSeo>` component). Import from `'next-seo/pages'`. Wrap in `<Head>{generateNextSeo({title: ..., description: ...})}</Head>`.

**Map**: Leaflet + react-leaflet v5, loaded client-side only via `next/dynamic` with `ssr: false`.

**Authentication**: JWT token in localStorage. Auth state in `app/authSlice.ts`. `AppAuthChecker` polls every 60s.

**Testing**: Jest + jsdom. Test files co-located with source. As of March 2026: 887 tests across 93 suites all pass. `identity-obj-proxy` and `@testing-library/dom` must be installed as devDeps. `simple-react-ui-kit` (pure ESM) is mapped via `moduleNameMapper` to `client/__mocks__/simple-react-ui-kit.tsx`. Shared test utilities live in `client/__mocks__/commonMocks.ts`.

**Test pattern for components that import applicationSlice/authSlice/notificationSlice**: Use inline store (NOT `commonMocks.ts`) and mock `@/utils/localstorage`, `next-i18next.config`, `cookies-next`, and `@/config/constants` before importing those slices. This prevents `getStorageLocale()` initialization failures. See `LoginForm.test.tsx`, `AppLayout.test.tsx`, `AppBar.test.tsx` for the canonical pattern.

**Test pattern for map components**: Mock `react-leaflet`, `leaflet`, and any Leaflet context hooks (`useLeafletContext`, `useMapEvents`, `useMap`). Never use the real Leaflet in tests — it requires a browser DOM that jsdom cannot provide. Temporal dead zone: never reference variables defined outside mock factories *inside* the factory (jest hoists mock calls above variable declarations). Solution: define mock data inside the factory, or use `jest.fn()` and override in `beforeEach`.

**Why:** Summarises the entire client codebase structure for quick context in future sessions.
**How to apply:** Use when suggesting refactors, new features, or bug fixes to stay consistent with existing patterns.
