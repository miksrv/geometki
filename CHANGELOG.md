# Changelog

## 1.7.0

### Patch Changes

- Homepage: hero sections and site stats — Added `MapHero` section with image and styles, a `Stats` server controller and `/stats` route returning aggregate counts, and a client stats API endpoint that renders a summary block on the homepage. Added homepage hero translations (EN/RU) and a `PopularCategories` section displaying top category cards in a grid layout.
- Top categories: API and UI — New `/categories/top` server endpoint backed by `getCoverPlaceByCategory` and `getTopByWeeklyViews` model methods. Client side: `topCategoriesGetList` RTK Query endpoint, TypeScript types, and a hero/cards grid layout with i18n keys for the categories section.
- Map: Wikipedia, Wikimedia Commons, and Pastvu layers — Added three new optional map overlay layers: Wikipedia POI markers (with API client, map component, utils, and unit tests), Wikimedia Commons media pins (same structure), and Pastvu historical photos layer. Each layer is toggle-able from the layer control. Standardized Leaflet tooltip font size across layers; memoized map marker icons to avoid unnecessary re-renders.
- Activity: dedicated page and compact list — Added a standalone Activity page (`/activity`) with menu entry and locales. `ActivityList` now supports compact view mode with embedded photo thumbnails and scroll-based pagination via `IntersectionObserver` (replacing manual scroll handlers). Added `visit` activity type to both server and client; `activity_title` removed from markers.
- Place: cover preview and visit logging — Server now generates a `1024×300` cover image on place creation/edit and records a view on each place detail fetch. Added a CLI command to regenerate cover previews for existing places. `cover.full` made optional in the `Place` TypeScript type; `visit_radius_m` and `updated` fields exposed in place preview responses.
- PageHeader and CategoryBadge components — Extracted a reusable `PageHeader` component (title + subtitle slot) and rolled it out across index pages (places, users, activity, categories). Added `CategoryBadge` component with styles for inline category labels. `UsersList` gained an optional `scrollable` prop; `Rating` gained a `className` prop and increased `border-radius`.
- SEO: noindex rules, breadcrumbs, and hreflang — User profile sub-pages marked `noindex, nofollow`. Geo-filtered place list URLs marked noindex; Yandex `Clean-param` directive added to `robots.txt` for filter query params. Breadcrumb markup improved and JSON-LD schemas updated. Hreflang keys added to the two-column layout; `cover` image added to place JSON-LD `image` array and location structured data spec extended.
- UI: places list layout and image sizing — `PlacesListItem` UI and skeleton loader refactored for visual consistency. Places list layout and carousel sizing adjusted; two-column gap reduced. Image sizing tuned across place and category cards. Tiny (`xs`) user avatar size added. `Place.content` made optional and container max-width increased.
- Client: `react-photo-album` and `ReadMore` removed — Dropped the `react-photo-album` dependency (gallery replaced with the existing custom implementation). Removed the `ReadMore` component and all related files. `Tooltip` component extracted, then consolidated into Leaflet layer usage only.
- i18n: time locale and key cleanup — `dayjs` time display now uses the active i18n locale. Stale and duplicated i18n keys cleaned up across EN/RU locale files; SEO title keys updated for the activity and categories pages.
- Node.js: bumped `.nvmrc` and SonarCloud workflow to Node 22 LTS — `client/.nvmrc` updated from `20.11.0` to `22`; `sonarcloud.yml` `node-version` updated from `20` to `22` to match the other CI workflows.

## 1.6.9

### Patch Changes

- Map page: hero section — Added a hero section on the map index page with `Next/Image` and a new CSS module. Localized `map-hero-title`, `map-hero-subtitle`, and `map-hero-cta` keys added to EN/RU locales. `WebApplication` JSON-LD block added to the map page.
- SEO: `JsonLdScript` and hreflang — Replaced manual `<script type="application/ld+json">` injections with `next-seo`'s `JsonLdScript` across place and user pages; removed `schema-dts` typed annotations. Added `buildHreflangTags` to user subpages (achievements, bookmarks, photos, places, visited). Tightened meta descriptions and updated OG images to full-size URLs.
- Client: remove locale gating and add default SEO template — Removed `isLocaleReady` state and conditional minimal-loader so the app renders immediately. Added default SEO title template (`'%s | Geometki'`) via `generateDefaultSeo`; simplified viewport meta.
- SEO: sitemap, localeDetection, robots — Disabled `localeDetection` and trailing slashes in `next.config.js`. Added `tags` static page to sitemap with a fixed `STATIC_LASTMOD` to prevent stale timestamps. Added `Disallow: /admin` to `robots.txt`.
- Achievements: seeder 2 — Added `AchievementsSeeder2` seeding collector, commenter, wanderer, pioneer, scout, and debut achievement tiers with XP, sort order, and rules.
- Notifications: increased page size and dynamic limit — Notification list now fetches 10 items per page (up from 5). Admin sending-mail page now uses `filters.limit` instead of a hardcoded 20.
- Server: sessions model custom IDs — Set `$useAutoIncrement = false` and added `id` to `$allowedFields` in `SessionModel` to allow externally generated session IDs.

## 1.6.8

### Patch Changes

- User profile: visited places page and tab — Added a dedicated `/users/[id]/visited` page listing a user's visited geotags with an embedded interactive map, pagination (21 per page), and SSR via `getServerSideProps`. Wired a new `UserPagesEnum.VISITED` tab into `UserTabs`. Server: new `Visited::user` action returns a paginated, formatted list of visited places for a given user.
- User profile: "places visited" statistic — Added `visited` to the `UserStatistic` type and displays its count in the user header. Server `Users` controller now queries `UsersVisitedPlacesModel` to populate the field; EN/RU translations updated (replaced unused `changed-covers` key with `places-visited`).
- User places page: embedded interactive map — User places page dynamically imports `InteractiveMap` (SSR disabled) and renders it when POI marks are available. Map data is prefetched server-side via `poiGetList.initiate` for SSR hydration.
- Interactive map: `controlsSize` prop and compact styles — Added a `controlsSize: 'small' | 'medium'` prop to `InteractiveMap` (default `'medium'`). When `'small'`, a compact CSS class shrinks zoom controls, button padding, icon sizes, and adjusts control positions. `PlaceInformation` now passes `controlsSize='small'` to its embedded map.
- POI: visited filter and user visited API — `Poi` controller reads a new `visited` query param and delegates to `PlacesModel::filterByVisitedUser`. Removed obsolete `marks/user` routes; table aliases added to avoid ambiguous-column errors on joined queries. Client `visitedGetUserPlaces` RTK Query endpoint added; `POI ListRequest` extended with `author` and `visited` filter fields; `UserPlacesRequest`/`UserPlacesResponse` types added to visited types.
- 404 page: localization and catch-all SSR handler — Refactored the 404 page to use `AppLayout`, `Container`, and `next-i18next` translations, replacing the static logo with localized text and button. Added `getStaticProps` with `serverSideTranslations`. Introduced a new `[...not-found].tsx` catch-all page that renders the same 404 UI via `wrapper.getServerSideProps`, hydrating auth from cookies and loading translations for server-side rendering of unknown routes.
- Repo: removed mobile directory — Deleted the unmaintained Expo/React Native `mobile/` sub-project (42 files, ~10 700 lines).
- Client: dependency upgrades — Bumped `next` to 16.2.6, `react`/`react-dom` to 19.2.6, `i18next` to 26.0.10, `react-i18next` to 17.0.7, `jest` to 30.4.1, `@typescript-eslint` packages to 8.59.2, and various other devDependencies; `yarn.lock` updated accordingly.
- Map: fix search navigation — Selecting a geosearch result from the AppBar now flies the map to the correct coordinates without requiring a page reload. Zoom from the search result (level 17) takes priority over the current map zoom. Resolved a URL-hash update loop that caused the map to jump back to a previous position while panning.
- AppBar search: fix dropdown reopening on map pan — Memoized the combined options array in `Search.tsx` so a new reference is only created when API data actually changes, preventing the Autocomplete dropdown from reopening on every URL hash update caused by map movement.

## 1.6.7

### Patch Changes

- Achievements: fix experience recalculation ignoring XP bonuses — `LevelsLibrary::calculate()` now joins `users_achievements` with `achievements` and adds the sum of earned `xp_bonus` values to the activity-based XP before comparing with the stored value. Previously, every profile request wiped achievement XP because `calculate()` only counted activity-table modifiers.
- Achievements: award delta XP on tier upgrade — `AchievementsLibrary::awardAchievement()` now fetches the previous tier's `xp_bonus` when upgrading and grants only the difference (`new_xp − old_xp`), keeping the stored experience consistent with what `calculate()` would recompute from scratch.
- Achievements: fix multi-rule progress aggregation — `getProgress()` now iterates all rules instead of only the primary one. `required` is the sum of all rule thresholds; `current` is the sum of `min(actual, threshold)` per rule. Single-rule achievements benefit too: a user with 101 places against a threshold of 10 now shows `10 / 10` instead of `101 / 10`.
- Achievements: fix tier selection showing wrong tier in grouped list — Replaced the `isCompleted` helper (which used `pct >= 100` and incorrectly flagged multi-rule achievements as done) with tier-order logic: find the highest earned tier by `earned_at`, then display the next tier above it, or the highest earned tier if all are complete, or the lowest tier if none are earned.
- Achievements: detail modal layout — Refactored `AchievementDetailModal` into a two-column layout: large medal icon on the left (`size={110}`) and all metadata (title, tier badge, description, date, XP) stacked on the right. Added `modalBody`, `modalImageCol`, `modalInfoCol` SASS classes; tightened margins via `gap`.
- Achievements: `earned_at` typed as `DateTime` — Changed `Achievement.earned_at` in the client API types from `string | null` to `DateTime`, consistent with other date fields.

## 1.6.6

### Patch Changes

- Users list: search, filtering, and sorting — Added `UsersFilterPanel` section component (role, gender filters + sort options). Users index page wired to panel state with defaults. Server `Users` controller extended to accept `search`, `sort`, and `order` query params; full-name search applied via `LIKE` on `name`/`surname`. EN and RU i18n keys added for all new controls.
- Places list: fade mask on excerpt — Added `.content` wrapper class and a CSS `::after` gradient overlay to `PlacesListItem` for smooth visual truncation of long place descriptions.
- Content sanitization: HTML stripping and entity decoding — `client/utils/text.ts` extended with `decodeEntities` and `stripHtml` helpers; applied to place descriptions on the client. Server `Places` controller now strips HTML tags from `content` before persisting.
- Place page UI: `WasHereButton` repositioned inside `PlaceShareButtons`; added bottom margin to the rating component for consistent spacing.
- Places: touch `updated_at` on no-change edits — New `PlacesModel::touchUpdatedAt()` method issues an explicit `UPDATE` to bump `updated_at` even when no other fields changed, ensuring the edit is always reflected in the timeline.

## 1.6.5

### Patch Changes

- Activity feed: improved pagination and grouping — Fetch N+1 items as a lookahead and drop the extra to enforce the requested limit. Added recursion depth limit to `addNextActivityItems`. Grouping now compares timestamps (≤600 s) and requires matching `place_id`/`user_id`. Group type priority refined: `place > edit > cover > photo`. Server ordering changed to `created_at DESC, type DESC`; `cover` activity type re-enabled; `rating.value` and `comments.content` joined and selected.
- Activity feed: cover label and scroll cursor fix — Added translation mapping for `ActivityTypes.Cover`. Refactored `IndexPage` scroll handler to derive `cursorDate` from the last item's `created.date`, replacing the previous `items.length` guard. `onScroll` dependencies updated to `[data, isFetching]`.
- Activity feed: scoped cache keys per author/place — `serializeQueryArgs` now namespaces cache keys with endpoint and `author`/`place` (e.g. `endpoint_author_<id>`) to prevent collisions and ensure correct per-query caching. `Cover` activity type re-enabled in `ActivityTypes`.
- Places model: expose `visit_radius_m` and `verification_exempt` — Both fields added to the `SELECT` clause in `PlacesModel` so they are returned by place queries and available for distance calculations and verification logic.
- Entity normalization: casts, dates, formatting — Standardized `$dates`, `$casts`, and array formatting across `UserAchievementEntity`, `UserBookmarkEntity`, `UserEntity`, `UserLevelEntity`, `UserNotificationEntity`, and `UserVisitedPlaceEntity`. Added `earned_at` and `visited_at` to relevant `$dates`; `read` cast changed to `boolean`.
- Entity formatting: `RatingEntity` `created` cast — Added `'created' => 'datetime'` cast to `RatingEntity`. Applied consistent formatting (trailing commas, datamap cleanup) across entity classes.
- Entity formatting: `OverpassCategory` explicit attributes and casts — Added `$attributes` and `$casts` to `OverpassCategory` so properties are properly typed. Removed commented-out `$dates` from `CategoryEntity`. Normalized array formatting across multiple entity classes.
- Places: avatar resolution for visited users — `AvatarLibrary` instantiated in the visited-users query; returned records now map raw `avatar` values to resolved paths via `buildPath('small')`.
- API: normalize place fields to camelCase — Renamed `visit_radius_m` → `visitRadiusM` and `verification_exempt` → `verificationExempt` in API responses. Server controller maps DB snake_case to camelCase and strips the originals; client models updated accordingly.
- Notifications: centralized localization and simplified meta — Server now reads the request locale and builds a simplified `meta` object (`title`, `level`/`image`) for `achievements` and `level` notifications. Client API model updated; notification UI simplified to use `meta.title`, removing locale-dependent rendering.
- Notifications and places: payload trimming and formatter extension — Removed unused fields from the `achievements` notification payload (only `title_en`, `title_ru`, `image` retained). `PlaceFormatterLibrary` extended to include `visit_radius_m` and `verification_exempt` in formatted place rows.

## 1.6.4

### Patch Changes

- Added "Was Here" visit verification feature: new `WasHereButton` component integrates with visited API endpoints, shows a geolocation confirmation dialog, supports offline visits via localStorage (24 h TTL) with automatic flush when back online, and dispatches auth dialog for unauthenticated users
- Added `PlaceVisited` component displaying visited and verified counts with an avatar group of recent visitors; integrated into the place page alongside `WasHereButton` in the share buttons area
- Added `Visited::check` server endpoint (`GET /visited`) reporting whether the authenticated user has visited a given place; enhanced `Visited::set()` to accept optional lat/lon, compute proximity verification via Haversine formula against `visit_radius_m`, store `visited_at/lat/lon/verified`, and return visit+verification status
- Added database migration: `visited_at`, `verified`, `lat`, `lon` columns to `users_visited_places`; `visit_radius_m` and `verification_exempt` columns to `places`; updated `UserVisitedPlaceEntity` and `UsersVisitedPlacesModel` accordingly
- Extended client visited API types: `visitedCheckPlace` query, `PutResponse` with `visited/verified` flags, `ListResponse` with `verified_count` and `total_count`; extended `Place` model with `visit_radius_m` and `verification_exempt`
- Added EN and RU translation keys for the visit confirmation dialog, location sharing, unconfirmed marking, and visit/verified counts
- Upgraded frontend dependencies: `next-i18next` to v16, `next-seo` to v7, `i18next`, `react-i18next`, `schema-dts`, `TypeScript`, and `@typescript-eslint` packages; updated `yarn.lock` accordingly
- Migrated all i18n imports across client components and pages from `next-i18next` to `next-i18next/pages` to match the new package entrypoint layout
- Migrated SEO markup on all pages from the `<NextSeo>` component to `generateNextSeo` rendered inside `next/head`; consolidated JSON-LD structured-data scripts into the same `<Head>` to remove duplicate wrappers
- Updated SASS files to use `@use` with a `variables` namespace instead of the legacy `@import`; fixed `@each` loops in achievement styles by quoting tier names for correct SASS parsing
- Fixed avatar path in `SendingMailManage`: use `user_avatar` row field instead of `avatar`
- Changed heatmap layer label to "Explorations" (updated EN/RU locale keys)
- Removed pathname restriction on the localhost `remotePattern` in `next.config.js` so assets at any path under `localhost:8080` are allowed
- Added 10 px padding to the tags grid for consistent spacing


## 1.6.3

### Patch Changes

- Added admin "Sent Emails" panel: new `SendingMailManage` controller exposes list, detail, filters, and aggregate stats endpoints; admin page at `/admin/sending-mail/` renders a filterable table and a detail view with full email body and per-recipient status
- Added `SendingMailDetail` client component and `SendingMailFilterPanel` section with RTK Query API endpoints and TypeScript types for the sent-emails admin feature
- Added `error` column to the `sending_mail` table via migration; `SendEmail` command now records delivery errors into that column for observability
- Added EN and RU i18n strings for the sent-emails admin panel; added "Sent Emails" item to the admin site menu
- Fixed `return` missing before `$this->respond()` in `Categories::list()` and `Location::search()/geoSearch()` — execution was falling through and sending a duplicate response
- Fixed `Photos::rotate()` and `PhotosTemporary::rotate()` returning `respondDeleted()` instead of `respondUpdated()` on a successful rotation
- Refactored all 24 server controllers to CI4 4.7.2 best practices: added class and method PHPDoc blocks, renamed private helpers from `_method()` to `method()` (PSR-12), tightened nullable/union type declarations, removed empty constructors
- Refactored all 26 server models to CI4 4.7.2 best practices: added class and method PHPDoc blocks, removed primary key and timestamp fields from `$allowedFields`, removed ghost `$deletedField` declarations on non-soft-delete models, removed empty callback arrays when `$allowCallbacks = false`, aligned `$validationRules` with `$allowedFields` to eliminate dead rules
- Fixed critical bug in `SendingMailModel`: `$useAutoIncrement = true` was combined with a `generateId` before-insert callback that assigned a hex string to the PK, causing a type mismatch on insert; callback removed
- Added generic TypeScript type parameter to the admin achievements table component

## 1.6.2

### Patch Changes

- Dropped the legacy `icon` name field from achievements in favour of image-based badges; updated TypeScript types, `AchievementIcon` component, admin UI, server migration, and seeder accordingly
- Fixed `AchievementIcon` image URL construction (trim leading/trailing slashes when joining `IMG_HOST` and image path); added `unoptimized` prop to `Next/Image` in the component
- Expanded achievements seeder with new tiers and badges: trailblazer, debut, collector, all-rounder, legend, gold streak, dedicated, and a set of seasonal achievements for 2026–2027
- Simplified `AchievementIcon` by removing redundant wrapper elements across achievement components; centralised sizing/styling in the component itself and cleaned up leftover SASS rules (`.iconWrapper`, `.badgeIcon`, `.iconCell`)
- Replaced inline achievement image logic in `NotificationIcon` with the shared `AchievementIcon` component; simplified `Notification` markup and removed tier text rendering from notification items
- Extracted `AchievementTierBadge` into its own `components/shared/achievement-tier-badge/` directory with self-contained styles; tier colours are now applied via `.tier--<tier>` modifier classes directly on the badge instead of relying on a parent container — fixes missing colours when the badge is used outside `AchievementCard` (e.g. admin table)
- Improved admin achievements table: title column now includes an edit link, optional description, and formatted season date range; removed the separate `season_start` column; simplified row actions to a single delete button
- Fixed achievement season date fields in the admin form to use `YYYY-MM-DD` (date-only) strings, preventing timezone/time-component issues in date inputs
- Rewrote `ConfirmationDialog` to a simpler API: replaced `onAccept`/`onReject` and `acceptText`/`rejectText` props with `onConfirm`/`onCancel`; removed Redux overlay handling; updated all usages (`PhotoGallery`, admin achievements page, `PlaceHeader`)
- Updated user level progression to a 30-level scale with revised XP thresholds and renamed levels (EN + RU translations)
- Bumped PHP server dependencies: CodeIgniter 4 to v4.7.2, Symfony HTTP Client to v7.4.8, Symfony Polyfill-PHP83 to v1.36.0

## 1.6.1

### Patch Changes

- Removed local `Dialog`, `Textarea`, `Dropdown`, and `SearchControl` UI components; replaced all usages with equivalents from `simple-react-ui-kit` (`Dialog`, `TextArea`, `Select`) to reduce duplication and align with the shared component library
- Refactored `PlaceCoverEditor` and `UserAvatarEditor` to use `Dialog` from `simple-react-ui-kit` with the `title` prop; moved save actions inside dialog content footer instead of using a removed `actions` prop
- Replaced dialog-based place filters with an inline `PlaceFilterPanel` using `Select` components from `simple-react-ui-kit`; removed Redux overlay toggles and dialog state from the Places page; added debounced location search and responsive horizontal layout
- Updated comment form to require `Ctrl+Enter` for submission to prevent accidental submits; replaced local `Textarea` with `TextArea` from `simple-react-ui-kit` (`autoResize`, `rows=1`)
- Refactored achievement tier colors: introduced `--color-tier-bronze`, `--color-tier-silver`, `--color-tier-gold` CSS variables in light and dark themes; replaced inline `style` / `TIER_COLORS` map with SASS `@each`-generated tier modifier classes across `AchievementCard`, `AchievementBadge`, and `AchievementDetailModal`
- Extracted `AchievementTierBadge` component to centralise tier label rendering with `Badge` from `simple-react-ui-kit`; badge is hidden when tier is `none`; reused in `AchievementCard` and `AchievementDetailModal`
- Refactored `AchievementDetailModal` to use `Dialog` from `simple-react-ui-kit`; replaced custom overlay and close button logic with library-provided overlay and a custom close icon button
- Improved notifications: fixed API pagination to replace the first page in full and deduplicate appended pages by `id`; removed `unreadCounter` state and `setUnreadCounter` action from the notification slice; switched `NotificationList` to read unread count from the API cache; `clearNotification` now uses `.unwrap()` with error toast on failure
- Removed `'use client'` directives from components that do not require them (`AppAuthChecker`, `Logo`, `LoginForm`, `RegistrationForm`, map controls, place sections, and others)
- Tightened spacing on the Places page container and filter panel for a more compact layout
- Bumped `simple-react-ui-kit` to `1.8.4` and `@typescript-eslint` packages to `8.59.0`

## 1.6.0

### Minor Changes

- Added full achievements system: server-side `AchievementsLibrary` evaluates and awards achievements on user activity; new `Achievement` and `UserAchievement` entities, models, and a dedicated `AchievementsController` with CRUD and admin redirect; achievements are triggered automatically via activity hooks and support localized text and icons (EN + RU language files)
- Added client achievements UI: `AchievementCard`, `AchievementsList`, `AchievementForm` components and admin achievements pages; user profile now includes an Achievements tab displaying earned badges via the `Badge` component; added achievements API endpoints in RTK Query and extended notification types for achievement events
- Added `AchievementIcon` component to centralise achievement icon rendering and replaced all inline icons/images with it; added support for external image URLs in icon sources; introduced an achievements color map and exported shared achievement components
- Improved weekly email digest: place cover images and titles are now included in digest emails; added preheader text and unsubscribe links to digest messages; HTML is queued per-user rather than as a full email blob; added hourly and daily sending limits to prevent over-sending; fixed unsubscribe endpoint behaviour
- Extracted category and level utilities into `@/utils`; removed feature-level type re-exports and redundant utility re-exports; normalised `@/utils` import paths across the client codebase
- Removed achievement activation endpoint and activation-related UI; the activation flow was replaced by automatic server-side evaluation
- Normalised `Container` spacing and `className` ordering across page components; simplified badge styles and adjusted component spacing for visual consistency
- Sourced `API_HOST` from centralised client config instead of inline environment variable references
- Added router mock and extended unit tests for notification icon components; bumped client dependencies and updated SonarCloud exclusion rules

## 1.5.1

### Patch Changes

- Added weekly email digest feature: `WeeklyDigestService` generates personalised summaries of new places and activity; new `system:weekly-digest` CLI command sends digests to opted-in users; digest send history tracked in `user_digest_logs` to prevent duplicates
- Added `emailDigest` notification preference setting; users can opt in/out via settings and unsubscribe via a dedicated endpoint (`POST /users/unsubscribe-digest`); unsubscribe link and i18n keys added to the digest email template
- Improved email infrastructure: refactored `EmailLibrary` and email view templates, added mail config debug helpers, and introduced a `system:test-email` CLI command for verifying mail delivery
- Added BIMI logo SVG for email brand identity support
- Added root `GET /` API info endpoint returning service name, version, and environment
- Fixed user listing responses to use total user count instead of filtered count, correcting pagination metadata
- Added initials-based avatar fallback for users without an uploaded avatar photo
- Refactored photo actions UI and header upload links for improved layout and consistency
- Switched analytics scripts to `next/script` for better performance and loading control
- Bumped client dependencies and set `bundler` module resolution in TypeScript config
- Expanded client unit test coverage: added test mocks and unit tests for app-bar, layout, map, shared, UI kit components, `useClientOnly`, `useLocalStorage`, and client utility functions
- Refactored test mocks and imports across the client test suite; standardised formatting and updated Jest config with new testing dependencies
- Improved ESLint config and added SonarCloud coverage badges; updated Sonar exclusion rules
- Added product ROADMAP documentation and expanded feature docs

## 1.5.0

### Minor Changes

- Added personalized recommendations and trending scores: introduced `trending_score` on places, per-user interest profiles (`user_interest_profiles`, `user_place_views`), and three new sort modes — `views_week`, `trending`, and `recommended`; authenticated users are automatically switched to the recommended sort on the Places page
- Added `AvatarLibrary`, `PhotoLibrary`, `PlaceFormatterLibrary`, and `ReputationLibrary` to centralise media processing and response formatting, reducing controller size and consolidating avatar/photo/cover/distance logic
- Refactored all controllers to use the new libraries; removed obsolete `Introduce`, `Migrate`, and `System` controllers; moved view/bookmark/notification queries into dedicated model methods (`recordView`, `incrementBookmarks`, `getRecentUnread`, `markRead`, etc.)
- Added `CacheHeadersFilter` and `ThrottleFilter` (rate-limit: 10 req/min per IP); updated `CorsFilter` to read an origin allowlist from the environment and return a `Vary: Origin` header; added a global `LocaleFilter`
- Hardened security across libraries: replaced `uniqid()` with `random_bytes`-based IDs in `ApplicationBaseModel`, replaced insecure session IDs with `bin2hex(random_bytes(16))` in `SessionLibrary`, and added PKCE `code_verifier` and per-request OAuth state to `VkClient`
- Improved controller security, validation, and performance: `Auth` pre-generates user IDs and reuses non-expiring JWT tokens; photo upload controllers enforce MIME/size checks and prevent path traversal; `Levels` replaces per-level DB queries with two bulk queries; `Poi` validates geographic bounds; `Rating` enforces score range 1–5
- Replaced hardcoded error strings across all controllers with `lang()` calls and added locale-aware language files (EN + RU) for `Comments`, `Rating`, `Bookmarks`, and `Visited`; extended language files for `Photos`, `Places`, `Users`, and `Auth`; wrapped I/O and external-service calls in `try/catch (Throwable)`
- Added 17 new PHPUnit unit tests covering activity grouping, model ID generation, avatar library, auth guards, cluster library, comment/rating/location validation, CORS filter, locale filter, service registration, tags search, and ID security
- Added CLI maintenance commands: `system:calculate-tags-count`, `trending:refresh`, `interests:refresh`, `system:send-email` (with per-user monthly/daily limits and cover attachments), and `system:generate-users-online`; removed the obsolete `FixCoverSizes` command
- Refactored the Tags page into modular components: `TagsControls`, `TagsAlphabetBar`, `TagsGrid`, `TagsStats`, and `TagsTrending` with alphabetical navigation, search, sort, and popularity display; added corresponding i18n keys
- Replaced localStorage-based auth persistence with HTTP cookies (60-day `maxAge`) and introduced `hydrateAuthFromCookies` to populate the Redux store from SSR request cookies, fixing stale auth on server-side renders
- Added an RTK Query `errorMiddleware` and `getErrorMessage` / `extractErrorMessage` utilities; API errors are now surfaced in the UI via `<Message>` components in forms (place create/edit, comments, user settings) and via Snackbar notifications for action buttons (bookmarks, rating, photo operations)
- Preserved auth state on `HYDRATE` by merging server token with client user data; moved `dayjs` locale/plugin initialisation into a `useEffect` so it follows i18n language changes
- Validated and sanitised `Location` controller search input; set an explicit `User-Agent` for Nominatim/OpenStreetMap requests in `Geocoder`
- Updated client dependencies (Next.js, dayjs, i18next, react-photo-album, simple-react-ui-kit, ESLint/Jest tooling)

## 1.4.30

### Patch Changes

- Major client refactoring: restructured project layout into feature-based architecture (`config/`, `utils/`, `hooks/`, `sections/`, `features/`, `app/`)
- Migrated Redux slices and store to `app/`, API types to `features/<domain>/`, and domain utilities to `features/`
- Extracted `components/layout/` and `components/map/` directories; renamed `components/common/` to `components/shared/`
- Cleaned up global SASS and extracted styles from `variables.sass`
- Cleaned up `api/index.ts` and extracted `isApiValidationErrors` helper
- Preserved RTK Query cache across navigation and added prefetching for user places
- Added performance optimisations: memoisation, RTK Query infinite scroll, and render improvements
- Added gamification features and completed roadmap audit
- Preloaded activities feed; fixed auth tag invalidation in RTK Query
- Fixed bugs: auth cookie handling, stale closures, regex issues, and SSR hydration
- Fixed `HYDRATE` payload cast to `RootReducerState` in Redux store
- Fixed `RootState` key in `notificationSlice`
- Fixed implicit `any` TypeScript error in coordinates map callbacks
- SEO: fixed user URLs in sitemap, added homepage entry, updated `Content-Type` header
- Added PHPUnit unit tests for server and fixed JWT/auth env vars in test setUp
- Updated CI/CD pipelines and added full API reference documentation

## 1.4.29

### Patch Changes

- Fixed Search locations from search in the map page
- Removed `enableSearch` and SearchControl UI Component for interactive map
- Implemented location search for global search
- Decrease global search debounce delay from 300 to 200
- Fixed 404 page for not found category in filter
- Upgraded UI Libraries

## 1.4.28

### Patch Changes

- Updated UI Kit, changed Dropdown to Select UI component
- Upgraded UI Dependencies
- Improved Place Form page

## 1.4.27

### Patch Changes

- Updated UI Locales
- Improved API Activity Controllers
- Improved UI ActivityListItem
- Improved UI UserAvatar, Rating and fixed UI styles
- Improved CI/CD API Deploy
- Upgraded UI Libraries, updated NextJS from `15` to `16`
- Replaced Progress UI Component for `simple-react-ui-kit`
- Removed old internal Progress UI Component

## 1.4.26

### Patch Changes

- Improved UI Menu, changed titles
- Fixed Some UI Component issues
- Improved UI Map Page
- Refactoring UI Locales
- Updated UI Dependencies

## 1.4.25

### Patch Changes

- Updated UI Libraries
- Fixed styles for Buttons as Link

## 1.4.24

### Patch Changes

- Updated UI Libraries
- Updated UI API for SSR
- Upgraded ESLint and Prettier
- Fixed UI code-style
- Update api.ts
- Fixed ESLint and Prettier issues
- Fixed Notifications and UserMenu UI components
- Improved Header UI code-style
- Fixed ESLint issue in the InteractiveMap UI Component
- Improved PagePlace components
- Upgraded UI styles
- Updated UI Libraries
- Fixed PhotoGallery
- Improved localstotage

## 1.4.23

### Patch Changes

-   Updated Codeigniter and other API libraries to latest versions
-   Updated UI libraries
-   Fixed UI Auth Page button (go to main page) top margin
-   Updated API Config
-   Improved GitHub CI/CD API Deployment
-   Added Changelog file
