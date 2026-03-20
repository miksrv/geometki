# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Geometki** is a full-stack geospatial POI (Points of Interest) sharing platform with collaborative mapping features. The monorepo contains three sub-projects: `client/` (Next.js web app), `server/` (CodeIgniter 4 PHP API), and `mobile/` (Expo React Native app).

## Commands

### Client (`cd client`)

```bash
yarn dev              # Dev server on :3000
yarn build            # Production build
yarn test             # Run Jest tests
yarn eslint:check     # Check ESLint violations
yarn eslint:fix       # Auto-fix ESLint violations
yarn prettier:check   # Check formatting
yarn prettier:fix     # Auto-format code
yarn locales:build    # Rebuild i18n translation files
```

Run a single test file: `yarn test functions/helpers.test.ts`

### Server (`cd server`)

```bash
composer install            # Install PHP dependencies
php spark serve             # Dev server on :8080
composer test               # Run PHPUnit tests
composer run migration:run  # Run pending migrations
php spark routes            # List all API routes
```

### Mobile (`cd mobile`)

```bash
npm start     # Expo dev server
npm run android
npm run ios
```

## Architecture

### Client

Uses **Next.js Pages Router** (not App Router) with **Redux Toolkit + RTK Query** for state and data fetching.

- `pages/` — Route entry points; each page uses `getServerSideProps` or `getStaticProps` with RTK Query
- `api/api.ts` — All RTK Query endpoint definitions (single API slice)
- `api/store.ts` — Redux store; uses `next-redux-wrapper` for SSR hydration
- `api/authSlice.ts`, `applicationSlice.ts`, `notificationSlice.ts` — Global state slices
- `api/types/` — TypeScript interfaces for all API response shapes
- `components/` — Split into `common/` (layout, header, shared UI) and `pages/` (page-specific)
- `functions/` — Pure utilities: `helpers.ts`, `coordinates.ts`, `validators.ts`; unit tests co-located as `*.test.ts`
- `middleware.ts` — Protects `/places/create` and `/users/settings` routes; redirects unauthenticated users
- `styles/` — Global SASS with dark/light theme variables

**i18n:** `next-i18next` with Russian (default, `/`) and English (`/en`) locales. Translation files are in `public/locales/`. Run `yarn locales:build` after adding new translation keys.

### Server

CodeIgniter 4 REST API following MVC pattern:

- `app/Controllers/` — One controller per resource (Places, Auth, Users, Photos, Activity, etc.)
- `app/Models/` — Data access (CI4 Model ORM)
- `app/Entities/` — Domain models with typed properties
- `app/Config/Routes.php` — All route definitions grouped by resource
- `app/Filters/CorsFilter.php` — CORS handling for all preflight requests
- `app/Database/Migrations/` — 25+ schema migrations; always create new migrations, never edit existing ones

**Auth:** JWT tokens passed as `Authorization: Bearer <token>` header. Session header as fallback.

### Key Patterns

- **API communication:** All frontend API calls go through RTK Query in `api/api.ts`. Add new endpoints there, not via `fetch`/`axios` directly.
- **Error format:** API returns `{ messages: { error?: string, [field]: string } }` — handle accordingly.
- **Image uploads:** Flow is temp upload → attach to entity. Server stores files in `uploads/` directory.
- **Map:** Leaflet via `react-leaflet` with Leaflet.heat for heatmaps. Map components must be dynamically imported (`next/dynamic` with `ssr: false`) because Leaflet requires `window`.

## Environment

**Client** (`.env` in `client/`):
```
NEXT_PUBLIC_API_HOST         # API base URL (e.g. http://localhost:8080/)
NEXT_PUBLIC_SITE_LINK        # Public site URL
NEXT_PUBLIC_MAPBOX_TOKEN     # Optional
NEXT_PUBLIC_CYCLEMAP_TOKEN   # Optional
```

**Server** (`.env` in `server/`): Configure database credentials, `app.baseURL`, and JWT secret. Use `cp env .env` as starting point.

## Tech Stack

- **Client:** Next.js 16 / React 19 / TypeScript 5 / Redux Toolkit / RTK Query / Leaflet / SASS / next-i18next / Yarn 4
- **Server:** PHP 8.2+ / CodeIgniter 4 / MySQL / JWT / Guzzle / Geocoder-PHP (Nominatim + Yandex)
- **Mobile:** Expo ~47 / React Native 0.70 / Redux Toolkit
- **CI:** GitHub Actions (lint + test + build checks on PR; separate deploy workflows)

## MCP Tools

Always use context7 MCP to get up-to-date documentation when:
- Writing or generating code that uses any library or framework
- Setting up configuration or dependencies
- Asking about any API or library usage

Use context7 tools automatically without waiting for explicit instruction:
1. First call `resolve-library-id` to get the correct library ID
2. Then call `get-library-docs` to fetch the actual documentation
3. Use that documentation to generate accurate, version-specific code