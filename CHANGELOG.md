# Changelog

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
