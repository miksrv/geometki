# Geometki

[![API Checks](https://github.com/miksrv/geometki/actions/workflows/api-checks.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/api-checks.yml)
[![UI Checks](https://github.com/miksrv/geometki/actions/workflows/ui-checks.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/ui-checks.yml)
[![UI Deploy](https://github.com/miksrv/geometki/actions/workflows/ui-deploy.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/ui-deploy.yml)
[![API Deploy](https://github.com/miksrv/geometki/actions/workflows/api-deploy.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/api-deploy.yml)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=miksrv_geometki&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=miksrv_geometki)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=miksrv_geometki&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=miksrv_geometki)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=miksrv_geometki&metric=bugs)](https://sonarcloud.io/summary/new_code?id=miksrv_geometki)

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=miksrv_geometki&metric=coverage)](https://sonarcloud.io/summary/new_code?id=miksrv_geometki)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=miksrv_geometki&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=miksrv_geometki)

**Geometki** is a crowdsourced platform for discovering and documenting interesting places across Russia. Users can add locations to an interactive map, upload photos, leave ratings and comments, and follow other travelers' activity. The platform has 1,100+ documented POIs spanning museums, waterfalls, abandoned structures, camping spots, and other landmarks.

**Live site:** [geometki.com](https://geometki.com)

## Repository Structure

```
geometki/
├── client/     # Next.js 16 web application (TypeScript)
├── server/     # CodeIgniter 4 REST API (PHP 8.2)
└── features/   # Feature specs (see features/README.md)
```

Further docs: [`server/API.md`](server/API.md) (API reference), [`client/DESIGN.md`](client/DESIGN.md) (client design system), [`CHANGELOG.md`](CHANGELOG.md), [`ROADMAP.md`](ROADMAP.md) and [`GROWTH-ANALYSIS.md`](GROWTH-ANALYSIS.md) (product direction).

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| Node.js   | >= 20.11.0 (CI uses 22) |
| Yarn      | 4.9.2       |
| PHP       | >= 8.2      |
| MySQL     | 5.7+        |
| Composer  | latest      |

PHP extensions required: `intl`, `mbstring`, `json`, `mysqlnd`, `curl`

## Local Development

### API Server

```bash
cd server
composer install
cp env .env          # then edit .env: set baseURL, database credentials, JWT secret
php spark migrate
php spark serve      # runs on http://localhost:8080
```

### Web Client

```bash
cd client
yarn install
cp env .env          # then edit the variables listed below
yarn dev             # runs on http://localhost:3000
```

### Tests and checks

```bash
cd client && yarn test && yarn eslint:check && yarn prettier:check
cd server && composer test
```

## Environment Variables

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_HOST` | API base URL, e.g. `http://localhost:8080/` |
| `NEXT_PUBLIC_SITE_LINK` | Public site URL, e.g. `http://localhost:3000/` |
| `NEXT_PUBLIC_IMG_HOST` | Image host (optional, defaults to `NEXT_PUBLIC_API_HOST`) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox API token (optional) |
| `NEXT_PUBLIC_CYCLEMAP_TOKEN` | Thunderforest Cycle Map token (optional) |
| `NEXT_PUBLIC_LANDING_CATEGORIES` | `"true"` turns on `/places/{category}` landing pages |
| `NEXT_PUBLIC_LANDING_LOCATIONS` | `"true"` turns on `/places/{location}` landing pages |
| `NEXT_PUBLIC_LANDING_COMBINATIONS` | `"true"` turns on `/places/{location}/{category}` (needs `NEXT_PUBLIC_LANDING_LOCATIONS`) |

The landing flags are baked in at build time; see `client/utils/placesLanding.ts` and `features/20-location-seo-pages.md`.

### Server (`server/.env`)

Configure `app.baseURL`, database connection (`database.default.*`), and JWT secret key. Use `cp env .env` as a starting point.

## Client Architecture

The web client (`client/`) uses the **Next.js Pages Router** with **Redux Toolkit + RTK Query**.

| Directory | Purpose |
|-----------|---------|
| `app/` | Redux store and state slices (auth, application UI, notifications) |
| `api/` | RTK Query API slice (`api.ts`), third-party slices (PastVu, Wikipedia, Wikimedia Commons), `models/` and `types/` for API shapes |
| `config/` | Environment constants (`IMG_HOST`, `SITE_LINK`, …) and app-wide constants |
| `components/layout/` | Application shell: AppBar, BottomNav, Footer, login/registration forms, snackbar, theme/language switchers |
| `components/map/` | Leaflet map subsystem: markers, clusters, layers, controls, measuring tools. Always dynamically imported with `ssr: false` |
| `components/shared/` | Domain components shared across pages: `PlaceCard`, `MediaTile`, `PhotoGallery`, `Rating`, … |
| `components/ui/` | Domain-agnostic primitives not covered by `simple-react-ui-kit` |
| `components/pages/`, `sections/` | Page-specific components, used by one route only |
| `pages/` | Route entry points; SSR via `getServerSideProps` with RTK Query |
| `hooks/` | Custom React hooks |
| `utils/` | Pure functions with co-located `*.test.ts` |
| `styles/` | Global SASS and `theme.css` token overrides on top of `simple-react-ui-kit` |
| `public/` | Static assets and `locales/` (Russian default, English) |
| `proxy.ts` | Auth guard for protected routes and rewrites for landing pages |

## Deployment

Deployment is automated via GitHub Actions on push to `main`.

### Frontend — SSH + PM2

Triggered when any file under `client/` changes, or manually ([`.github/workflows/ui-deploy.yml`](.github/workflows/ui-deploy.yml)):

1. Installs Node.js 22 and dependencies.
2. Writes `client/.env` from secrets and runs `yarn build` (Next.js standalone output).
3. Removes the old `.next` directory on the server via SSH.
4. Rsyncs `client/.next/standalone/`, `client/.next/static`, `client/public`, `ecosystem.config.js` and `next-i18next.config.js` to `/var/www/geometki.com` on the VPS.
5. Restarts the app with `pm2 restart geometki.com`.

**Required secrets:** `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`, `NEXT_PUBLIC_API_HOST`, `NEXT_PUBLIC_SITE_LINK`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_CYCLEMAP_TOKEN`

**First deploy on a new server:**
```bash
# After the first rsync, on the VPS:
pm2 start ecosystem.config.js && pm2 save
```

### Backend — FTP

Triggered when any file under `server/` changes ([`.github/workflows/api-deploy.yml`](.github/workflows/api-deploy.yml)):

1. Sets up PHP 8.2 and runs `composer install --no-dev --optimize-autoloader`.
2. Uploads `.htaccess`, `app/`, `vendor/`, `public/` and `writable/` to the server via LFTP (parallel FTP).

**Required secrets:** `FTP_HOSTNAME`, `FTP_USERNAME`, `FTP_PASSWORD`

### CI Checks

Run on pull requests to `main`:

- ESLint + Prettier, Jest unit tests and the production build (client)
- PHPUnit tests (server)
- SonarCloud analysis

## API

REST JSON API on CodeIgniter 4. JWT Bearer token in the `Authorization` header; errors come as `{ "messages": { "error": "...", "<field>": "..." } }`. Full endpoint reference: [`server/API.md`](server/API.md); live route list: `php spark routes`.

Maintenance and cron commands are `spark` commands; list them with `php spark list` (e.g. `system:send-email`, `digest:weekly`, `achievements:evaluate`, `trending:refresh`, `osm:collect`).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web frontend | Next.js 16, React 19, TypeScript, Redux Toolkit + RTK Query, simple-react-ui-kit |
| Mapping | Leaflet, react-leaflet, Leaflet.heat |
| Styling | SASS / CSS Modules, dark/light theme |
| i18n | next-i18next (Russian / English) |
| API | CodeIgniter 4, PHP 8.2, MySQL |
| Auth | JWT (firebase/php-jwt), email + password, magic link, Google / Yandex / VK OAuth |
| Geocoding | Nominatim, Yandex (geocoder-php) |
| CI/CD | GitHub Actions, SonarCloud |
| Process manager | PM2 |
