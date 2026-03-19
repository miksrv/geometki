# Geometki

[![API Checks](https://github.com/miksrv/geometki/actions/workflows/api-checks.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/api-checks.yml)
[![UI Checks](https://github.com/miksrv/geometki/actions/workflows/ui-checks.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/ui-checks.yml)
[![UI Deploy](https://github.com/miksrv/geometki/actions/workflows/ui-deploy.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/ui-deploy.yml)
[![API Deploy](https://github.com/miksrv/geometki/actions/workflows/api-deploy.yml/badge.svg)](https://github.com/miksrv/geometki/actions/workflows/api-deploy.yml)

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

Run on every push and non-draft pull request to `main` ([`.github/workflows/checks.yml`](.github/workflows/checks.yml)):

- ESLint + Prettier (client)
- Jest unit tests (client)
- Next.js production build (client)
- PHPUnit tests (server)

## API Documentation

The backend exposes a REST JSON API built with CodeIgniter 4 (PHP 8.2). The full endpoint reference is in [`server/API.md`](server/API.md).

Authentication uses JWT Bearer tokens. Error responses follow the shape `{ "messages": { "error": "..." } }`.

### Resource summary

| Resource | Base path | Description |
|----------|-----------|-------------|
| Auth | `/auth` | Registration, login, OAuth (Google / Yandex / VK), current user |
| Places | `/places` | Create, read, update, delete POI records |
| POI | `/poi` | Lightweight map-marker data and clustering |
| Photos | `/photos` | Photo upload, rotate, delete (permanent and temporary) |
| Users | `/users` | User profiles, avatar upload/crop, settings |
| Rating | `/rating` | Per-place ratings and voting history |
| Comments | `/comments` | Place comments and replies |
| Activity | `/activity` | Grouped activity feed (places, photos, edits, ratings) |
| Bookmarks | `/bookmarks` | Toggle and check bookmarks for a place |
| Visited | `/visited` | Toggle and list "visited" marks for a place |
| Notifications | `/notifications` | Per-user notification feed and badge count |
| Location | `/location` | Location search, geocoder, session coordinates |
| Categories | `/categories` | Place category list with optional counts |
| Tags | `/tags` | Tag list and autocomplete search |
| Levels | `/levels` | Gamification levels, experience thresholds, awards |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web frontend | Next.js 16, React 19, TypeScript, Redux Toolkit + RTK Query |
| Mapping | Leaflet, react-leaflet, Leaflet.heat |
| Styling | SASS/CSS Modules, next-themes (dark/light) |
| i18n | next-i18next (Russian / English) |
| API | CodeIgniter 4, PHP 8.2, MySQL |
| Auth | JWT (firebase/php-jwt) |
| Geocoding | Nominatim, Yandex (geocoder-php) |
| Mobile | Expo ~47, React Native 0.70 |
| CI/CD | GitHub Actions |
| Process manager | PM2 |
