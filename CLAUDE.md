# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Geometki** is a full-stack geospatial POI (Points of Interest) sharing platform with collaborative mapping features. The monorepo contains two sub-projects: `client/` (Next.js web app) and `server/` (CodeIgniter 4 PHP API).

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
yarn locales:build    # Rebuild i18n translation files (see the warning under i18n)
```

Run a single test file: `yarn test utils/helpers.test.ts`. If almost every suite fails with `React.act is not a function`, the shell has `NODE_ENV=production`; run `NODE_ENV=test yarn test`.

### Server (`cd server`)

```bash
composer install            # Install PHP dependencies
php spark serve             # Dev server on :8080
composer test               # Run PHPUnit tests
composer run migration:run  # Run pending migrations
php spark routes            # List all API routes
```

## Architecture

### Client

Uses **Next.js Pages Router** (not App Router) with **Redux Toolkit + RTK Query** for state and data fetching.

- `pages/` — Route entry points; pages fetch data in `getServerSideProps` with RTK Query
- `api/api.ts` — All endpoints of the project API (one RTK Query slice); `apiPastvu.ts`, `apiWikimediaCommons.ts`, `apiWikipedia.ts` are separate slices for external map layers
- `api/types/`, `api/models/` — TypeScript shapes of requests/responses (`ApiType`) and entities (`ApiModel`)
- `app/store.ts` — Redux store; uses `next-redux-wrapper` for SSR hydration. `app/authSlice.ts`, `applicationSlice.ts`, `notificationSlice.ts` — global state slices
- `components/` — `layout/` (app bar, bottom nav, footer), `map/` (Leaflet), `shared/` (domain components), `ui/` (generic primitives), `pages/` (a few page-specific leftovers); `sections/<area>` — page-specific compositions
- `utils/` — Pure utilities (`helpers.ts` barrel, `coordinates.ts`, `validators.ts`, `placesLanding.ts`, …); unit tests co-located as `*.test.ts`; `hooks/` — custom hooks; `config/env.ts` — env constants
- `proxy.ts` — Next.js proxy (formerly middleware); protects `/places/create`, `/places/:id/edit` and `/users/settings` routes; redirects unauthenticated users; also rewrites `/places/{category|location}` and `/places/{location}/{category}` to `pages/places/landing/[...slug].tsx` when the matching `NEXT_PUBLIC_LANDING_*` flag is on (see Environment below and `features/20-location-seo-pages.md`)
- `styles/` — Global SASS; `theme.css` holds project token overrides on top of `simple-react-ui-kit/theme.css` (imported first in `pages/_app.tsx`)
- `DESIGN.md` — the client design system: layers (kit primitives vs domain components), layouts, the `MediaTile` / `PlaceCard` / `CollectionCard` rules and UI patterns. Read it before adding or changing any user-facing component; one component per entity, variants for layout.

**i18n:** `next-i18next` (import from `next-i18next/pages`) with Russian (default, `/`) and English (`/en`) locales, one namespace: `public/locales/<lang>/common.json`. `yarn locales:build` runs i18next-scanner with `removeUnusedKeys: true`, so it deletes keys used only through template strings, e.g. `categoryCatalogue.<name>.*` (`utils/categories.ts`); check the diff and restore them, or edit the JSON by hand.

### Server

CodeIgniter 4 REST API following MVC pattern:

- `app/Controllers/` — One controller per resource (Places, Auth, Users, Photos, Activity, etc.)
- `app/Models/` — Data access (CI4 Model ORM)
- `app/Entities/` — Domain models with typed properties
- `app/Config/Routes.php` — All route definitions grouped by resource
- `app/Filters/CorsFilter.php` — CORS handling for all preflight requests
- `app/Commands/` — spark CLI jobs (`trending:refresh`, `osm:collect`, `digest:weekly`, …)
- `app/Database/Migrations/` — schema migrations; always create new migrations, never edit existing ones

**Auth:** JWT in the `Authorization` header (`app/Libraries/SessionLibrary.php`); the `Session` header identifies anonymous sessions.

### Key Patterns

- **API communication:** All frontend API calls go through RTK Query in `api/api.ts`. Add new endpoints there, not via `fetch`/`axios` directly.
- **Error format:** API returns `{ messages: { error?: string, [field]: string } }` — handle accordingly.
- **Image uploads:** Flow is temp upload → attach to entity. Server stores files in `server/public/uploads/`.
- **Map:** Leaflet via `react-leaflet` with Leaflet.heat for heatmaps. Map components must be dynamically imported (`next/dynamic` with `ssr: false`) because Leaflet requires `window`.
- **Categories:** there is no `category` table. The server only whitelists the keys (`server/app/Config/Categories.php`, `in_list` validation) and returns the key (`category: "waterfall"`); there is no categories listing endpoint and no `/categories` page — the filter on `/places` and the category icons on cards are the way into a category. The catalogue is on the client: keys in `client/api/models/category.ts` (`ApiModel.Categories`), icons `client/public/images/poi/<key>.png` and colours wired up in `client/utils/categories.ts`, texts in `public/locales/<lang>/common.json` under `categoryCatalogue.<name>` (`title` label, `landing` page name, `content` intro). Adding a category touches the enum, an icon, a colour, both locales and the server config.

## Environment

**Client** (`.env` in `client/`):
```
NEXT_PUBLIC_API_HOST         # API base URL (e.g. http://localhost:8080/)
NEXT_PUBLIC_SITE_LINK        # Public site URL
NEXT_PUBLIC_IMG_HOST         # Optional, defaults to NEXT_PUBLIC_API_HOST
NEXT_PUBLIC_MAPBOX_TOKEN     # Optional
NEXT_PUBLIC_CYCLEMAP_TOKEN   # Optional
NEXT_PUBLIC_LANDING_CATEGORIES    # "true" to turn on /places/{category} (features/20-location-seo-pages.md, stage 2); unset/anything else = off
NEXT_PUBLIC_LANDING_LOCATIONS     # "true" to turn on /places/{location} (stage 3)
NEXT_PUBLIC_LANDING_COMBINATIONS  # "true" to turn on /places/{location}/{category} (stage 4); has no effect unless NEXT_PUBLIC_LANDING_LOCATIONS is also "true"
```
Each landing flag independently switches canonical URLs, 301s, site links and sitemap entries for its page type on; with all three unset the site is byte-for-byte what it was before that feature. See `client/utils/placesLanding.ts` (`getLandingFlags`, `buildPlacesHref`) for the single source of truth on what each flag does, and `features/20-location-seo-pages.md` for the full spec.

**Server** (`.env` in `server/`): Configure database credentials, `app.baseURL`, the JWT secret (`auth.token.secret`) and `cors.allowedOrigins` (comma-separated; unset allows `*`). Use `cp env .env` as starting point. For a local stand that uses a production database with images served from production (client `NEXT_PUBLIC_IMG_HOST=https://api.geometki.com/`), set `uploads.verifyFiles = false`, otherwise the API drops covers whose files are not on the local disk.

## Tech Stack

- **Client:** Next.js 16 / React 19 / TypeScript 6 / Redux Toolkit / RTK Query / Leaflet / SASS / next-i18next / next-seo / Jest / Yarn 4
- **Server:** PHP 8.2+ / CodeIgniter 4 / MySQL / JWT / Guzzle / Geocoder-PHP (Nominatim + Yandex)
- **CI:** GitHub Actions (`ui-checks`, `api-checks` on PR; `ui-deploy`, `api-deploy`; SonarCloud)

## Pull Request Checklist

Before opening a PR from a feature branch:

1. Bump `"version"` in `client/package.json`. Almost always the **patch** number; the **minor** number only for noticeable new features or UX changes; the **major** number practically never.
2. Add a new section for that version to the top of `CHANGELOG.md` (repo root), following the existing format: `## X.Y.Z`, then `### Patch Changes` or `### Minor Changes`, then a bulleted list. Keep entries very short, one line each, e.g. `- Layout: removed the site sidebar, widened the content area`. Write the changelog in English only, including UI labels (translate them, e.g. "Add to collection", not "В коллекцию").

## Release

Only after the PR with the version bump is merged into `main` (never before):

1. Tag the merge commit on `main` with the new version: `v` + the version from `client/package.json`, e.g. `v1.9.0` (same style as the existing `v1.8.x` tags).
2. Create a GitHub release for that tag, like the existing ones: title is the tag name (`v1.9.0`), body is that version's section from `CHANGELOG.md` without the `## X.Y.Z` heading (starts with `### Minor Changes` / `### Patch Changes`), marked as latest. One command does both: `gh release create v1.9.0 --target main --title v1.9.0 --notes-file <section.md> --latest`.

## MCP Tools

Always use context7 MCP to get up-to-date documentation when:
- Writing or generating code that uses any library or framework
- Setting up configuration or dependencies
- Asking about any API or library usage

Use context7 tools automatically without waiting for explicit instruction:
1. First call `resolve-library-id` to get the correct library ID
2. Then call `get-library-docs` to fetch the actual documentation
3. Use that documentation to generate accurate, version-specific code