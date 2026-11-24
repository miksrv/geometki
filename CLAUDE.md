# CLAUDE.md

**Geometki** — a map of interesting places, made by its users, with a game on top. Monorepo: `client/` (Next.js 16, React 19, TypeScript, Redux Toolkit + RTK Query, Leaflet, SASS, Jest, Yarn 4) and `server/` (PHP 8.2+, CodeIgniter 4, MySQL). API reference: `server/API.md`; client design system: `client/DESIGN.md`; open problems: `ISSUES.md`; plans: `ROADMAP.md`, `features/`.

## Commands

```bash
# client/
yarn dev | yarn build | yarn test [file] | yarn eslint:check | yarn prettier:check
# server/
composer install | php spark serve | composer test | composer run migration:run | php spark routes
```

If almost every Jest suite fails with `React.act is not a function`, run `NODE_ENV=test yarn test`.

## Client

**Pages Router** (not App Router). `pages/` routes, `sections/<area>/` page compositions, `components/{layout,map,shared,ui}`, `utils/` (co-located `*.test.ts`), `hooks/`, `content/` (long static-page texts as `<page>.<locale>.md`, `loadContent()`; a new page goes into `ContentPage` and `outputFileTracingIncludes` in `next.config.js`), `proxy.ts` (route guards, landing rewrites, live-page routing).

- **Read `DESIGN.md` before any user-facing change**; one component per entity, variants for layout; check `simple-react-ui-kit` before building a primitive.
- **Admin** (`/admin/*`) is a workspace of its own (`AdminLayout`, side navigation), not a page of the site: read `client/ADMIN-UI.md` before any admin change — action-first dashboard, lists with views and filters in the URL, sections in `utils/admin.ts`.
- **API calls** only through RTK Query in `api/api.ts`, never `fetch`/`axios`. Types: `api/types` (`ApiType`), `api/models` (`ApiModel`).
- **i18n:** `next-i18next` (import from `next-i18next/pages`), RU default (`/`) and EN (`/en`), one file `public/locales/<lang>/common.json`. Every new key goes to both locales (real English); delete unused keys, minding keys built from templates (`categoryCatalogue.<name>.*`). Data functions call `loadPageTranslations()`.
- **Map** components load with `next/dynamic`, `ssr: false`.
- **Categories** live on the client: enum `api/models/category.ts`, icon `public/images/poi/<key>.png`, colour `utils/categories.ts`, texts `categoryCatalogue.<name>`; the server only whitelists keys (`Config/Categories.php`). Never put category titles into the DB/API.
- **Page cache:** place, home, activity, collection and user pages are ISR, rendered without cookies — nothing visitor-specific in them (distance, own score, online marks come in the browser). `proxy.ts` (`CACHED_PAGES`) sends visitors the cache does not fit (signed-in, a `location` cookie, a non-Moscow `tz`, a query the page reads) to `pages/live/...` (same component and `load<X>Page.ts`). The API re-renders place and collection pages after writes (`SitePages::place()` / `::collection()`); a write that changes a place page without a place activity must call `SitePages::place()`.
- **Visitor location** is asked only on the visitor's action (`hooks/useUserLocation.ts`), kept in the `location` cookie and sent as explicit `lat`/`lon`; never on page load. **Time zone:** the `tz` cookie; without it days are Moscow days.

## Server

`app/Controllers` (one per resource), `Models`, `Entities`, `Libraries`, `Config/Routes.php`, `Commands` (spark jobs). **Never edit a migration that is already in production (on `main`) — add a new one;** one that exists only in the release branch may be edited. Migrations never create awards (achievements, medals): those are made by hand in the admin.

- **Auth:** JWT in `Authorization`; the `Session` header identifies a guest, created only by their first rating. A guest's `Session` goes only with writes and `GET rating/:id`, so their other GETs hit the guest cache.
- **Errors:** `{ messages: { error?: string, [field]: string } }`.
- **Guest cache** (`GuestCacheFilter`, `Config/GuestCache.php`): public GETs without `Authorization`/`Session` are cached for a day, any write clears it. A GET whose answer depends on more than locale, path and query stays out of `$groups`; one that changes without a write needs a `$ttls` entry.
- **Activity is the log of everything:** `ActivityLibrary` writes each action and attaches it to a feed story (`FeedLibrary`, `FeedAggregator`; `php spark feed:rebuild` after changing grouping). Experience is counted from the log (`LevelsLibrary::experience()`, `MODIFIER_*`), never pushed alone and never recounted on a read; reputation is rebuilt from votes (`ReputationLibrary`). **Every removal goes through `ActivityRemoval`** (collect before delete, `apply()` after); `->by($userId)` on one's own removal also takes back revocable awards. Full recount: `php spark reputation:rebuild`.
- **Notifications:** `Config/Notifications.php`; email (`Libraries/Mail`, views in `Views/emails/`, texts in `Language/*/Emails.php`) and push (`Libraries/Push`) queues, sent by `notifications:send`. **Cron:** the hosting runs only `php spark cron:run` every 5 minutes; it starts the jobs by `Config/Cron.php` (intervals or times, `.env` `cron.<job>`); a new periodic job is added there, not to the hosting. Service accounts (`$serviceEmailDomains`) get nothing.
- **Visits:** "Я здесь был(а)" is a log, one visit per user and place a week, one tap, no form; a tap within the week cancels it. After a check-in come one-tap questions (`Config/VisitQuestions.php`, texts `visitQuestions.<key>`), summarised in `places_now`. A bare visit gives no experience. **White spots** are open OSM candidates (`osm_candidates`); the author of a place made from one is its pioneer.

## The game (2.0.0)

Details: `server/API.md` → "Game", `DESIGN.md` → "The game", numbers in `server/app/Config/Game.php`.

- **Words in texts:** геометки — places; геопоинты — season points; исследование — visiting a place, so people are исследователи; открытие — adding a place; квесты — hand-made walks. **«Маршрут» / `route` is reserved** for a future route planner — never use it for quests.
- **Confirmed visit:** the one check-in button always sends the position (asked on the tap); near the place the visit is confirmed, otherwise plain — never an error. A photo with EXIF shot near the place confirms too (`PhotoLibrary`, `GameLibrary::photoUploaded()`), and "Я сейчас здесь" confirms the visit of the week later. Near is the category's radius cut by the nearest other place, or near the place's OSM outline (`places_outlines`, `php spark places:outlines`): never a radius per place by hand. Confirmation works with or without a season; a season only adds geopoints. A place counts once a season per person (`game_points`).
- **Seasons** are made by hand on the site (`/game/seasons/create`, `/game/seasons/:id/edit`, admins only; buttons on `/game` and on a season's page — no admin section, no reminders) (`game_seasons`): own dates (never overlapping), title, description and one picture — the medal of every participant, with gold/silver/bronze variants for places 1–3; nothing is created automatically, and without a current season the game shows the next one or waits. `php spark game:tick` closes a season after its grace days and freezes its table; the medal follows the frozen place (1–3 gold/silver/bronze, the rest the grey one). Limited awards are separate, listed on a season by their dates.
- **Exploration** (`explored()`) is the share of a location's places a person has visited, for all time; geopoints live only in a season.
- **Quests** (`QuestsLibrary`, API `game/quests/*`, client `/quests`) are no part of a season: walked once, started only by «Начать квест», experience only at the end. Modes `open` / `steps` / `riddles` / `photos`; for the secret ones (`SECRET_MODES`) the next point never leaves the server and their visits stay hidden until the walk ends. Never cached.
- **Client:** `/game` is the current season, or the next one (only past seasons have pages); admins create and edit seasons there (`SeasonForm` in `sections/game`), `/game/help` is «Как играть» (`content/game-help.*.md`), `sections/game`, `PlaceGame`, hrefs in `utils/game.ts`. Quests never mention a timer.

## Environment

- **Client** `client/.env`: `NEXT_PUBLIC_API_HOST`, `NEXT_PUBLIC_SITE_LINK`, `NEXT_PUBLIC_IMG_HOST`, map tokens, and the landing flags `NEXT_PUBLIC_LANDING_{CATEGORIES,LOCATIONS,COMBINATIONS}` (`"true"` = on; baked in at build; `utils/placesLanding.ts`, spec `features/20`).
- **Server** `server/.env` (`cp env .env`): database, `app.baseURL`, `auth.token.secret`, `cors.allowedOrigins`. On the production DB locally set `uploads.verifyFiles = false`.

## Pull requests and releases

- Branch per release: `release/X.Y.Z`; work for a release goes into its branch.
- Before a PR: bump `client/package.json` (patch by default, minor for noticeable features) and add `## X.Y.Z` to the top of `CHANGELOG.md`: a one-sentence summary, `### Patch Changes` / `### Minor Changes`, one-line bullets under ~100 chars, user-visible only, English, UI labels translated.
- Release, after the PR is merged: `gh release create vX.Y.Z --target main --title vX.Y.Z --notes-file <section.md> --latest`.
- Library code or config: fetch current docs with context7 first.
