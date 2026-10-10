---
name: geometki-client-architecture
description: Core architecture, stack, and patterns used in the geometki Next.js client
type: project
---

Next.js 16 (Pages Router) with React 19, TypeScript 6. CLAUDE.md and client/DESIGN.md hold the overview; this file keeps what they don't.

**State**: Redux Toolkit + RTK Query. Store and slices in `app/` (`store.ts`, `authSlice.ts`, `applicationSlice.ts`, `notificationSlice.ts`, `errorMiddleware.ts`). `api/api.ts` is monolithic (all project endpoints in one slice; an `injectEndpoints` split is not worth it). Extra RTK Query slices for map layers: `APIPastvu`, `APIWikimediaCommons`, `APIWikipedia`. SSR hydration via `next-redux-wrapper`.

**Directories**: `app/` (store), `api/` (`api.ts`, `types/` = `ApiType`, `models/` = `ApiModel`), `config/` (`constants.ts`, `env.ts`), `hooks/`, `utils/` (pure functions by domain, barrel `helpers.ts`), `components/{layout,map,shared,ui,pages}`, `sections/{collections,home,place,sending-mail,user}`, `pages/`, `styles/` (`theme.css`, `globals.sass`, `variables.sass`, `mixins.sass`, `animations.sass`).

**Import paths**:
- Store hooks: `import { useAppDispatch, useAppSelector } from '@/app/store'`
- API: `import { API, ApiModel, ApiType } from '@/api'`
- Env constants: `import { IMG_HOST, SITE_LINK } from '@/config/env'`
- Validation helper: `import { isApiValidationErrors } from '@/utils/api'`

**Styling**: SASS modules per component (`styles.module.sass`), tokens as CSS custom properties (kit `theme.css` + `styles/theme.css`). `%placeBottomPanel` placeholder in `variables.sass` (`@use` variables, then `@extend`).

**Auth**: JWT and session id in cookies (`AUTH_COOKIES` in `config/constants.ts`), state in `app/authSlice.ts`; `AppAuthChecker` (app bar) polls every 60s.

**Testing**: Jest + jsdom, tests co-located. `simple-react-ui-kit` (pure ESM) is mapped via `moduleNameMapper` to `client/__mocks__/simple-react-ui-kit.tsx`. Shared helpers in `client/__mocks__/commonMocks.ts` (store factory, `renderWithStore`, `mockRouter`, `mockUseTranslation`, fixtures).

**Test pattern for components that import app slices directly**: use an inline store (not `commonMocks.ts`) and mock `@/utils/localstorage`, `next-i18next.config`, `cookies-next` and `@/config/constants` before importing the slices, so their initial state does not fail. Canonical examples: `LoginForm.test.tsx`, `AppLayout.test.tsx`, `AppBar.test.tsx`.

**Test pattern for map components**: mock `react-leaflet`, `leaflet` and Leaflet context hooks (`useLeafletContext`, `useMapEvents`, `useMap`); never use real Leaflet in jsdom. Jest hoists `jest.mock` above declarations, so don't reference outer variables inside mock factories — define data inside the factory or use `jest.fn()` overridden in `beforeEach`.

**How to apply:** stay consistent with these patterns when adding features or fixing bugs.
