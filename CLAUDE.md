# CLAUDE.md

**Geometki** — a geospatial POI sharing platform with collaborative mapping. Monorepo: `client/` (Next.js web app) and `server/` (CodeIgniter 4 PHP API).

## Commands

### Client (`cd client`)

```bash
yarn dev              # Dev server on :3000
yarn build            # Production build
yarn test             # Jest; one file: yarn test utils/helpers.test.ts
yarn eslint:check     # / eslint:fix
yarn prettier:check   # / prettier:fix
```

If almost every suite fails with `React.act is not a function`, the shell has `NODE_ENV=production`; run `NODE_ENV=test yarn test`.

### Server (`cd server`)

```bash
composer install
php spark serve             # Dev server on :8080
composer test               # PHPUnit
composer run migration:run  # Pending migrations
php spark routes            # All API routes
```

## Architecture

### Client

**Next.js Pages Router** (not App Router) with **Redux Toolkit + RTK Query**.

- `pages/` — routes; data is fetched in `getServerSideProps` with RTK Query
- `api/api.ts` — all project API endpoints (one RTK Query slice); `apiPastvu.ts`, `apiWikimediaCommons.ts`, `apiWikipedia.ts` — external map layers; `api/types/`, `api/models/` — request/response (`ApiType`) and entity (`ApiModel`) shapes
- `app/store.ts` — store with `next-redux-wrapper` for SSR hydration; slices `authSlice`, `applicationSlice`, `notificationSlice`
- `components/` — `layout/` (app bar, bottom nav, footer), `map/` (Leaflet), `shared/` (domain components), `ui/` (generic primitives), `pages/` (page-specific leftovers); `sections/<area>` — page-specific compositions
- `utils/` — pure utilities with co-located `*.test.ts`; `hooks/`; `config/env.ts` — env constants
- `proxy.ts` — Next.js proxy (formerly middleware): guards `/places/create`, `/places/:id/edit`, `/users/settings`; rewrites landing URLs to `pages/places/landing/[...slug].tsx` when the `NEXT_PUBLIC_LANDING_*` flags are on
- `styles/theme.css` — project token overrides on top of `simple-react-ui-kit/theme.css` (imported first in `pages/_app.tsx`)
- `DESIGN.md` — the client design system. Read it before adding or changing any user-facing component; one component per entity, variants for layout.

**i18n:** `next-i18next` (import from `next-i18next/pages`), Russian (default, `/`) and English (`/en`), one namespace: `public/locales/<lang>/common.json`. No extraction script: keep both locale files in sync by hand — every new key goes to `ru` and `en` (real English), unused keys are deleted, minding keys built from template strings, e.g. `categoryCatalogue.<name>.*` (`utils/categories.ts`).

### Server

CodeIgniter 4 REST API, MVC:

- `app/Controllers/` (one per resource), `app/Models/` (CI4 ORM), `app/Entities/`
- `app/Config/Routes.php` — all routes; `app/Filters/CorsFilter.php` — CORS
- `app/Commands/` — spark CLI jobs (`php spark list`)
- `app/Database/Migrations/` — always create new migrations, never edit existing ones

**Auth:** JWT in the `Authorization` header (`app/Libraries/SessionLibrary.php`); the `Session` header identifies anonymous sessions. Sessions hold no coordinates.

**Visitor location:** asked from the browser only on the visitor's action (`client/hooks/useUserLocation.ts`: "My location" on the map, sorting by distance), never on page load. Kept in the client's `location` cookie and sent to the API as explicit `lat`/`lon` (SSR reads the cookie, `client/utils/userLocation.ts`). Only a signed-in user's last point is stored (`users.last_lat/last_lon`, `PUT /location`), shown nowhere.

**Visitor time zone:** calendar days (feed day headings, the contribution calendar) are the visitor's days. The browser keeps its IANA zone in the `tz` cookie (`client/utils/timeZone.ts`); pages with days read it in `getServerSideProps` into `application.timeZone` and pass it to `GET /feed/calendar?tz=`. Without the cookie days are Moscow days (`SITE_TIMEZONE`).

**Notifications:** types, channels and defaults in `app/Config/Notifications.php` (`users.settings` keys `{channel}{Type}`, `NotificationSettings`). Service accounts (`Notifications::$serviceEmailDomains`, e.g. `user2@geometki.com`) get no notifications at all, while their actions still notify real owners. One cron job, `notifications:send`, sends queued emails then pushes and cleans old queue rows; queues share the `QueueRows` mechanics (atomic claims, back-off retries).
- **Email** (`app/Libraries/Mail/`): `MailQueue` (table `sending_mail`), `Mailer` is the SMTP transport (`smtp.*` in `.env`). Every email is a view in `Views/emails/` inside `emails/layout.php`, texts in `Language/{ru,en}/Emails.php`. Weekly digests are throttled (`digestHourLimit`, `digestDayLimit`); settings are re-checked at send time. Unsubscribe links carry a signed `UnsubscribeToken`; `GET /mail/unsubscribe` only reads, `POST` turns off. Preview: `php spark email:preview`; real send: `php spark system:test-email you@example.com`.
- **Push** (`minishlink/web-push`, VAPID keys `push.*` in `.env`, `php spark push:vapid`): `NotifyLibrary::push()` queues to `push_messages` (`app/Libraries/Push/PushQueue`) when the type is pushable, the user wants it and has a device (`push_subscriptions`). A push is dropped if the notification was seen on the site, grouped and held in quiet hours; an email about an event a push delivered is not sent. Client: `public/sw.js`, `utils/push.ts`, `hooks/usePushSubscription.ts`, the `PushPrompt` card.

**Activity and the feed:** `ActivityLibrary` writes every user action to `activity` (the log behind XP, achievements, notifications, the digest and place history) and attaches it to a story in `feed` (`FeedLibrary`, grouping rules in `FeedAggregator`), so `GET /feed` is one indexed query. After changing the grouping rules run `php spark feed:rebuild`.

### Key Patterns

- **API calls:** only through RTK Query in `api/api.ts`, never `fetch`/`axios` directly.
- **Error format:** `{ messages: { error?: string, [field]: string } }`.
- **Image uploads:** temp upload → attach to entity; files in `server/public/uploads/`.
- **Map:** `react-leaflet`; map components are imported with `next/dynamic` and `ssr: false`.
- **Categories:** no `category` table and no categories endpoint/page. The server whitelists keys (`server/app/Config/Categories.php`, `in_list`) and returns the key (`category: "waterfall"`). The catalogue is on the client: keys in `client/api/models/category.ts` (`ApiModel.Categories`), icons `client/public/images/poi/<key>.png`, colours in `client/utils/categories.ts`, texts in `common.json` under `categoryCatalogue.<name>` (`title`, `short`, `landing`, `content`). A new category touches the enum, an icon, a colour, both locales and the server config.

## Environment

**Client** (`client/.env`): `NEXT_PUBLIC_API_HOST`, `NEXT_PUBLIC_SITE_LINK`, optional `NEXT_PUBLIC_IMG_HOST` (defaults to the API host), `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_CYCLEMAP_TOKEN`, and the landing flags (`"true"` = on, anything else = off):
- `NEXT_PUBLIC_LANDING_CATEGORIES` — `/places/{category}`
- `NEXT_PUBLIC_LANDING_LOCATIONS` — `/places/{location}`
- `NEXT_PUBLIC_LANDING_COMBINATIONS` — `/places/{location}/{category}`, only together with `LOCATIONS`

Each flag switches canonical URLs, 301s, site links and sitemap entries for its page type; with all three off the site is as before the feature. Source of truth: `client/utils/placesLanding.ts` (`getLandingFlags`, `buildPlacesHref`); spec: `features/20-location-seo-pages.md`.

**Server** (`server/.env`, start from `cp env .env`): database credentials, `app.baseURL`, `auth.token.secret` (JWT), `cors.allowedOrigins` (comma-separated; unset allows `*`). For a local stand on the production database with images from production (client `NEXT_PUBLIC_IMG_HOST=https://api.geometki.com/`) set `uploads.verifyFiles = false`, otherwise the API drops covers missing on the local disk.

## Tech Stack

- **Client:** Next.js 16 / React 19 / TypeScript 6 / Redux Toolkit / RTK Query / Leaflet / SASS / next-i18next / next-seo / Jest / Yarn 4
- **Server:** PHP 8.2+ / CodeIgniter 4 / MySQL / JWT / Guzzle / Geocoder-PHP (Nominatim + Yandex)
- **CI:** GitHub Actions (`ui-checks`, `api-checks` on PR; `ui-deploy`, `api-deploy`; SonarCloud)

## Pull Request Checklist

Before opening a PR from a feature branch:

1. Bump `"version"` in `client/package.json`: almost always **patch**; **minor** only for noticeable new features or UX changes; **major** practically never.
2. Add a section for that version to the top of `CHANGELOG.md` in the existing format: `## X.Y.Z`, then `### Patch Changes` or `### Minor Changes`, then short one-line bullets, e.g. `- Layout: removed the site sidebar, widened the content area`. English only, UI labels translated ("Add to collection", not "В коллекцию").

## Release

Only after the version-bump PR is merged into `main`: tag the merge commit `v<version>` and create the GitHub release (title = tag, body = that version's `CHANGELOG.md` section without the `## X.Y.Z` heading, marked latest) in one command:
`gh release create v1.9.0 --target main --title v1.9.0 --notes-file <section.md> --latest`.

## MCP Tools

When writing code or config that uses a library, fetch its current docs with context7 (`resolve-library-id`, then `get-library-docs`) without waiting to be asked.
