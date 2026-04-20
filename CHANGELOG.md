# Changelog

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
