# Changelog

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
