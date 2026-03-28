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
├── client/   # Next.js 16 web application (TypeScript)
├── server/   # CodeIgniter 4 REST API (PHP 8.2)
└── mobile/   # Expo / React Native mobile app
```

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| Node.js   | >= 20.11.0  |
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
# create client/.env with the variables listed below
yarn dev             # runs on http://localhost:3000
```

### Mobile App

```bash
cd mobile
npm install
npm start            # Expo dev server
```

## Environment Variables

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_HOST` | API base URL, e.g. `http://localhost:8080/` |
| `NEXT_PUBLIC_SITE_LINK` | Public site URL, e.g. `http://localhost:3000/` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox API token (optional) |
| `NEXT_PUBLIC_CYCLEMAP_TOKEN` | Thunderforest Cycle Map token (optional) |

### Server (`server/.env`)

Configure `app.baseURL`, database connection (`database.default.*`), and JWT secret key. Use `cp env .env` as a starting point.

## Client Architecture

The web client (`client/`) uses the **Next.js Pages Router** with **Redux Toolkit + RTK Query**. After a recent refactoring the codebase is organised into domain-focused layers rather than technical ones.

```
client/
├── app/                    # Redux store, typed hooks, and state slices
├── api/                    # RTK Query createApi() shell and Pastvu third-party slice
├── config/                 # Environment constants (IMG_HOST, SITE_LINK) and app-wide constants
├── features/               # Per-domain API types and utilities (17 domains)
│   ├── activity/
│   ├── auth/
│   ├── bookmarks/
│   ├── categories/         # includes categoryImage() utility
│   ├── comments/
│   ├── levels/             # includes levelImage() and nextLevelPercentage() utilities
│   ├── location/
│   ├── notifications/
│   ├── photos/
│   ├── places/
│   ├── poi/
│   ├── rating/
│   ├── sitemap/
│   ├── tags/
│   ├── users/
│   └── visited/
├── components/
│   ├── layout/             # Application shell: AppBar, Footer, SiteMenu, LoginForm, Snackbar, …
│   ├── map/                # Leaflet map subsystem: markers, clusters, controls, heatmap, …
│   ├── shared/             # Domain-aware components shared across pages: PhotoGallery, PlacePlate, Rating, …
│   └── ui/                 # Pure UI primitives: Dialog, Carousel, Pagination, Tabs, Dropdown, …
├── sections/               # Page-specific component groups (never imported by other pages)
│   ├── place/              # PlaceHeader, PlaceDescription, PlaceCommentList, PlaceForm, …
│   ├── user/               # UserHeader, UserForm, UserAvatarEditor, UserTabs
│   ├── categories/         # CategoriesList
│   └── tags/               # TagList
├── pages/                  # Next.js route files (Pages Router)
├── hooks/                  # Custom React hooks: useClientOnly, useLocalStorage
├── utils/                  # Pure utility functions: date, text, number, url, coordinates, …
├── styles/                 # Global SASS, theme variables, light/dark CSS
└── public/                 # Static assets and i18n locale files (ru / en)
```

### Directory Descriptions

| Directory | Purpose |
|-----------|---------|
| `app/` | Redux store configuration and state slices for auth, application UI, and notifications |
| `api/` | `createApi()` shell that stitches together all RTK Query endpoints; also contains the Pastvu third-party slice |
| `config/` | Centralised environment constants (`IMG_HOST`, `SITE_LINK`) and localStorage key names |
| `features/<domain>/` | Each feature owns its TypeScript types (models + request/response shapes) and any domain-specific utilities |
| `components/layout/` | Persistent application chrome: top bar, footer, navigation menu, auth dialogs, snackbar, theme/language switchers |
| `components/map/` | Self-contained Leaflet map system with 12+ sub-components (markers, clusters, heatmap, controls). Always dynamically imported with `ssr: false` |
| `components/shared/` | Domain-aware components used by multiple pages: `ActivityList`, `PhotoGallery`, `PlacePlate`, `Rating`, `BookmarkButton`, etc. |
| `components/ui/` | Domain-agnostic UI primitives with no business logic: `Dialog`, `Carousel`, `Pagination`, `Tabs`, `Dropdown`, `Autocomplete`, etc. |
| `sections/` | Page-specific sections colocated by route; a section is used by exactly one page and is never imported elsewhere |
| `pages/` | Next.js Pages Router entry points; each page uses `getServerSideProps` or `getStaticProps` with RTK Query for SSR |
| `hooks/` | Custom React hooks: `useClientOnly` (SSR guard), `useLocalStorage` (typed localStorage binding) |
| `utils/` | Pure functions organised by concern: `date.ts`, `text.ts`, `number.ts`, `url.ts`, `coordinates.ts`, `address.ts`, `schema.ts`, `validators.ts`, etc. |
| `styles/` | `globals.sass`, `variables.sass` (SASS vars only), `animations.sass`, and `light.css` / `dark.css` theme overrides |
| `public/` | Static assets (icons, images) and `locales/` i18n files for Russian (default) and English |

## Deployment

Deployment is fully automated via GitHub Actions on every push to `main`.

### Frontend — SSH + PM2

Triggered when any file under `client/` changes ([`.github/workflows/ui-deploy.yml`](.github/workflows/ui-deploy.yml)):

1. Installs Node.js 20 and dependencies.
2. Injects secrets into `client/.env` and runs `yarn build` (Next.js standalone output).
3. Removes the old `.next` directory on the server via SSH.
4. Rsyncs `client/.next/standalone/`, `client/.next/static`, `client/public`, and `ecosystem.config.js` to `/var/www/geometki.com` on the VPS.
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
2. Uploads `app/`, `vendor/`, `public/`, `writable/`, and `.htaccess` to the server via LFTP (parallel FTP).

**Required secrets:** `FTP_HOSTNAME`, `FTP_USERNAME`, `FTP_PASSWORD`

### CI Checks

Run on every push and non-draft pull request to `main`:

- ESLint + Prettier (client)
- Jest unit tests (client)
- Next.js production build (client)
- PHPUnit tests (server)

## API Reference

The backend exposes a REST JSON API built with CodeIgniter 4 (PHP 8.2). All endpoints are prefixed with the configured `app.baseURL`.

**Authentication:** JWT Bearer token via `Authorization: Bearer <token>` header (session ID accepted as fallback).
**Error shape:** `{ "messages": { "error": "...", "<field>": "..." } }`
**Paginated responses** include `items` (array) and `count` (total) fields.

---

### Auth — `/auth`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/auth/me` | Return current session info and user data (includes a fresh JWT token) | — |
| POST | `/auth/login` | Sign in with email and password | — |
| POST | `/auth/registration` | Create a new account with email and password | — |
| GET | `/auth/google` | Start Google OAuth flow or handle the callback redirect | — |
| GET | `/auth/yandex` | Start Yandex OAuth flow or handle the callback redirect | — |
| GET | `/auth/vk` | Start VK OAuth flow or handle the callback redirect | — |

---

### Places — `/places`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/places/` | List places with filtering (category, author, location, tags), sorting, text search, and distance calculation | — |
| GET | `/places/{id}` | Detailed place record including tags, editors, author, and cover photo | — |
| POST | `/places/` | Create a new place (title, category, coordinates; optional tags and photos) | Required |
| PATCH | `/places/{id}` | Update place content, coordinates, category, or tags | Required |
| PATCH | `/places/cover/{id}` | Set a place's cover image from an uploaded photo with crop/dimension parameters | Required |
| DELETE | `/places/{id}` | Delete a place and all its associated photos (admin only) | Required |

---

### POI — `/poi`

Lightweight endpoint optimised for map rendering and clustering.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/poi/` | All POI map markers with optional clustering, bounds, and category filtering | — |
| GET | `/poi/{id}` | Single POI details by ID | — |
| GET | `/poi/photos` | Photo markers clustered by location for the map layer | — |
| GET | `/poi/users` | Active user location markers (last 500 sessions with coordinates) | — |

---

### Photos — `/photos`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/photos/` | List photos with pagination; filter by place or author | — |
| POST | `/photos/upload/temporary` | Upload a temporary photo before a place is created; returns preview | Required |
| POST | `/photos/upload/{id}` | Upload and attach a photo to an existing place | Required |
| PATCH | `/photos/rotate/temporary/{id}` | Rotate a temporary photo 90° counter-clockwise | Required |
| PATCH | `/photos/rotate/{id}` | Rotate an attached photo 90° counter-clockwise | Required |
| DELETE | `/photos/temporary/{id}` | Delete a temporary photo | Required |
| DELETE | `/photos/{id}` | Delete an attached photo and update the place photo count | Required |

---

### Users — `/users`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/users/` | Paginated user list sorted by recent activity | — |
| GET | `/users/{id}` | User profile with reputation, level, and statistics | — |
| PATCH | `/users/{id}` | Update profile fields (name, website, password, notification settings) | Required |
| POST | `/users/avatar` | Upload an avatar image to temporary storage | Required |
| PATCH | `/users/crop` | Crop the temporary avatar and generate small (40 px) and medium (80 px) versions | Required |

---

### Rating — `/rating`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/rating/{id}` | Current rating for a place and the authenticated user's own vote | — |
| GET | `/rating/history` | Rating history filtered by `userId` or `placeId` | — |
| PUT | `/rating/` | Cast or update a vote for a place (affects place rating and author reputation) | — |

---

### Comments — `/comments`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/comments/` | All comments for a place (`?place=<id>`) | — |
| POST | `/comments/` | Post a new comment or reply to an existing one | Required |
| GET | `/comments/unsubscribe` | Unsubscribe from a specific email notification type via tokenised link | — |

---

### Activity — `/activity`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/activity/` | Paginated, grouped activity feed (place creation, edits, photos, ratings, comments) | — |

---

### Notifications — `/notifications`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/notifications/updates` | Unread notifications from the last 15 minutes (up to 10; used for the snackbar) | Required |
| GET | `/notifications/list` | Paginated full notification history grouped by place/activity | Required |
| DELETE | `/notifications/` | Clear all notifications for the current user | Required |

---

### Bookmarks — `/bookmarks`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/bookmarks/` | Check whether a place is bookmarked by the current user (`?placeId=<id>`) | — |
| PUT | `/bookmarks/` | Toggle bookmark state for a place | Required |

---

### Visited — `/visited`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/visited/{id}` | List users who have marked a specific place as visited | — |
| PUT | `/visited/` | Toggle a place's visited state for the current user | Required |

---

### Categories — `/categories`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/categories/` | All POI categories with optional place counts (`?count=true`) | — |

---

### Tags — `/tags`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/tags/` | All tags sorted by frequency and last update | — |
| GET | `/tags/search` | Autocomplete tag search by text (max 10 results, 1–30 characters) | — |

---

### Levels — `/levels`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/levels/` | All gamification levels with experience thresholds, award multipliers, and the top-10 users per level | — |

---

### Location — `/location`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/location/search` | Search for administrative regions (country, region, district, city) by text | — |
| GET | `/location/geosearch` | Geocode an address or place name via Nominatim / Yandex | — |
| GET | `/location/{id}` | Details for a specific administrative region by ID and type | — |
| PUT | `/location/` | Store the current user's coordinates in the server session | — |

---

### Sitemap — `/sitemap`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sitemap/` | All place and user IDs with their last-modified timestamps for SEO sitemap generation | — |

---

### CLI Commands

| Command | Description |
|---------|-------------|
| `php index.php system recalculate_tags_count` | Recalculate tag usage counts |
| `php index.php system generate_users_online` | Generate active user session data |
| `php index.php system send_email` | Dispatch pending notification emails |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web frontend | Next.js 16, React 19, TypeScript, Redux Toolkit + RTK Query |
| Mapping | Leaflet, react-leaflet, Leaflet.heat |
| Styling | SASS/CSS Modules, dark/light theme |
| i18n | next-i18next (Russian / English) |
| API | CodeIgniter 4, PHP 8.2, MySQL |
| Auth | JWT (firebase/php-jwt), Google / Yandex / VK OAuth |
| Geocoding | Nominatim, Yandex (geocoder-php) |
| Mobile | Expo ~47, React Native 0.70 |
| CI/CD | GitHub Actions |
| Process manager | PM2 |
