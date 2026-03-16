# Client Roadmap

This document catalogues bugs, performance issues, code quality problems, accessibility gaps, and missing test coverage found during a thorough review of the Next.js client codebase.

---

## Performance

- **#11 `components/common/interactive-map/InteractiveMap.tsx`**: This single component is ~430 lines and manages map layers, markers, fullscreen, position storage, type switching, and category control. The entire component re-renders on any state change (e.g. cursor position updates on every `mousemove`). The cursor position update path (`setCursorPosition`) should be isolated behind `React.memo` or moved to a child component so the parent does not re-render on every pixel of mouse movement.

- **#12 `pages/places/[id]/index.tsx`**: `placeSchema` and `breadCrumbSchema` are recomputed on every render because they are plain object literals, not memoised. Wrap them in `useMemo` to avoid unnecessary object allocations.

- **#13 `pages/places.tsx`**: The `handleChangeFilter` function is recreated on every render and passed to a deep child tree. Wrap it in `useCallback`.

- **#14 `components/common/photo-gallery/PhotoGallery.tsx` (line 51–53)**: The `isEmptyPhotoList` `useMemo` dependency array contains the expression `!uploadingPhotos?.length` (a boolean) rather than `uploadingPhotos?.length` (a number). This means the memo re-runs more than necessary and can return stale values in some update sequences.

- **#15 `pages/index.tsx` and `pages/users/[id]/index.tsx`**: The infinite-scroll handler is added with `document.addEventListener('scroll', …)` and is recreated on every render inside a `useEffect` that depends on `[lastDate, isFetching, data]`. Prefer a `useCallback`-memoised handler and a stable `useEffect` dependency list.

- **#16 `api/api.ts` `activityGetInfinityList`**: The infinite-list merge/forceRefetch logic is commented out. The current implementation falls back to a standard query, meaning each "load more" call replaces the cache entry and the consumer must manually accumulate items in local state (the stale-closure bug above). Implementing the native RTK Query infinite scroll pattern with `serializeQueryArgs` + `merge` would eliminate this local state management entirely.

- **#17 `components/common/app-layout/app-bar/AppAuthChecker.tsx`**: Polls `auth/me` every 60 seconds on every page. The poll continues even when the browser tab is hidden. Add `skipPollingIfUnfocused: true` to the query options to reduce unnecessary network traffic.

- **#18 `functions/schema.ts` `PlaceSchema`**: Passes raw `place.content` (Markdown source) as the schema.org `description` field. The `removeMarkdown` helper exists for this purpose but is not called here, leaving Markdown syntax in structured data.

---

## Code Quality

- **#19 `next.config.js` (line 7)**: `reactStrictMode: false` is disabled with the comment "Authorization does not work in this mode". Strict Mode double-invocation of effects exposes real bugs (like the side effects in Redux slices). The root cause should be fixed and Strict Mode re-enabled.

- **#20 `api/store.ts`**: Uses the deprecated `AnyAction` type from `@reduxjs/toolkit`. This type has been removed in newer versions of RTK. Replace with `UnknownAction`.

- **#21 `functions/helpers.ts`**: File has a `// TODO: Rename to utils` comment at the top. There are also similar cleanup TODOs in `functions/constants.ts`, `functions/coordinates.ts`, `api/types/comments.ts`, `api/types/photos.ts`, `api/types/rating.ts`, `api/types/visited.ts`, and `api/apiPastvu.ts`. These indicate accumulated technical debt that should be resolved.

- **#22 `pages/places/create.tsx`, `pages/places/[id]/edit.tsx`, `pages/users/settings.tsx`**: All three pages cast `validationErrors as any` when passing to form components. The `PlaceForm` and `UserForm` accept `errors?: ApiType.*.PostItemRequest` but the API returns a `Record<keyof T, string>`. A proper error type should be defined and threaded through instead of silencing the type system.

- **#23 `components/common/interactive-map/InteractiveMap.tsx`**: Has a `// TODO: Refactor this component` at the top. The component mixes concerns: tile layer selection, marker rendering, fullscreen handling, localStorage persistence, and event handling. Splitting into focused sub-components would improve maintainability.

- **#24 `pages/map.tsx` (line 41–43)**: Two separate state variables `categories` and `mapCategories` track essentially the same thing (category filter) with one being debounced for the API and one for immediate UI feedback. The naming and relationship is acknowledged as confusing via a `// TODO: Categories and categories?` comment.

- **#25 `components/common/interactive-map/coordinates-control/CoordinatesControl.tsx`**: The labels `Lat:` and `Lon:` are hardcoded English strings, not passed through i18n.

- **#26 `components/common/app-layout/app-bar/UserMenu.tsx` (line 50)**: `До нового уровня:` is a hardcoded Russian string not passed through the translation system.

- **#27 `components/common/app-layout/login-form/LoginForm.tsx` (line 115)**: The `useEffect` cleanup sets `localeError` to an empty string, but `localeError` is never set to anything other than `''` in this component (the state is declared and used but nothing ever calls `setLocaleError` with a non-empty value). The state and its cleanup are dead code.

- **#28 `api/apiPastvu.ts`**: The entire file is marked `// TODO: Refactoring` and defines its own local types (`Photo`, `RequestNearestGetPhotos`, `ResponseNearestGetPhotos`) that are not shared with the rest of the model layer. The types should live in `api/models/` for consistency.

- **#29 `functions/coordinates.ts`**: Uses the old `function()` syntax throughout (acknowledged with a TODO) and suppresses TypeScript errors with `// @ts-ignore` in multiple places. Migrating to arrow functions and proper generics would remove the suppressions.

- **#30 `pages/places.tsx` (line 88–94)**: The canonical URL manually strips `lat`, `lon`, `sort`, and `order` from query params to avoid duplicate content. This pattern is fragile — if new transient params are added to the filter, they must also be remembered here.

---

## Accessibility

- **#31 `components/common/app-layout/AppLayout.tsx` (lines 103–118)**: The "scroll to top" button uses `role="button"` on a `<div>` with an `onKeyDown` handler that does nothing (`() => undefined`). Keyboard users cannot activate it. Either use a `<button>` element or implement proper key handling (Enter/Space).

- **#32 `components/common/app-layout/AppLayout.tsx` (lines 120–129)**: The overlay `<div role="button">` has an `onKeyDown={handleCloseOverlay}` but fires on any key press rather than only Enter/Space as per ARIA specification.

- **#33 `components/common/rating/Rating.tsx`**: The star rating uses radio `<input>` elements visually hidden inside `<label>` elements, but the `<ul>` element wrapping them has no `role` or `aria-label`. Screen readers will announce this as a plain list. Add `role="radiogroup"` and a descriptive `aria-label` to the `<ul>`.

- **#34 `components/common/interactive-map/coordinates-control/CoordinatesControl.tsx`**: The coordinates panel is a `<Container>` (div) with an `onClick` handler but no `role`, `tabIndex`, or keyboard event handler, making it inaccessible to keyboard and screen reader users.

- **#35 `components/pages/place/place-share-buttons/PlaceShareButtons.tsx` (line 100)**: A `<div role="button">` is used for a share action without keyboard support. Use `<button>` instead.

- **#36 `components/common/app-layout/login-form/LoginForm.tsx`**: Social login buttons (`<Button>` for VK, Google, Yandex) render `<Image>` with `alt=""`. Without a visible label or an `aria-label` on the button itself, screen readers will announce these as unlabelled buttons. Add `aria-label` values such as `"Sign in with Google"`.

- **#37 `styles/globals.sass` (line 74)**: Global `a` styles set `outline: none`, removing the default focus indicator for keyboard users on all links across the app. A custom visible `:focus-visible` style should be provided.

- **#38 Multiple pages**: The `<main>` content area inside `AppLayout` has no `id` and there is no skip-navigation link, making it impossible for keyboard/screen reader users to bypass the navigation menu.

- **#39 `components/common/interactive-map/InteractiveMap.tsx`**: `attributionControl={false}` removes the map attribution. While this is a valid styling choice, the map tiles (OSM, Google, Mapbox) legally require attribution; it should be rendered elsewhere in the UI.

---

## Testing

- **#40 `functions/helpers.ts`**: `removeMarkdown`, `formatDate`, `timeAgo`, `ratingColor`, `round`, `addDecimalPoint`, and `encodeQueryData` are covered by `helpers.test.ts`. However, the broken regex patterns in `removeMarkdown` (links and images) are not tested, so those bugs pass tests silently. Add cases for standard Markdown link and image syntax.

- **#41 `functions/validators.ts`**: `validateEmail` has no test file. It is used in login and registration forms and the regex is minimal (`/^[^@ ]+@[^@ ]+\.[^@ .]+$/`). It should be tested against edge cases (subdomains, plus-addressing, invalid formats).

- **#42 `api/authSlice.ts`, `api/applicationSlice.ts`, `api/notificationSlice.ts`**: No tests exist for any Redux slice. The `login`/`logout` reducers, cookie side-effects, and `Notify` thunk are critical paths with no coverage.

- **#43 `functions/localstorage.ts`**: No tests. The module wraps all localStorage access for the app; errors here affect authentication persistence, locale detection, and map state. Edge cases (corrupted JSON, SSR environment, missing keys) should be tested.

- **#44 `components/ui/pagination/Pagination.tsx`**: No tests for the `fetchPageNumbers` / `range` pagination logic. The algorithm has several boundary conditions (first page, last page, neighbour overflow) that are untested.

- **#45 `middleware.ts`**: The route-guard middleware has no tests. It protects `/places/create` and `/users/settings` from unauthenticated access; regression coverage would catch any breakage during refactors.

- **#46 General**: Only two test files exist in the entire project (`functions/helpers.test.ts` and `functions/coordinates.test.ts`). No component tests, no API slice tests, and no integration tests are present. Critical user journeys (login, place creation, photo upload flow) are entirely untested.

---

## Dependencies

- **#47 `nextjs-progressbar`**: Listed as `^0.0.16`, which is very old and unmaintained. The package has known compatibility issues with React 18 and Next.js 13+. The project now uses Next.js 16 and React 19. Consider replacing with `nprogress` directly or implementing a route-change progress indicator using the App Router's built-in `useRouter` events.

- **#48 `remove` (version `^0.1.5`)**: A tiny package in `dependencies` that provides no clear benefit. It appears unused in the source files reviewed. Verify with a bundle analyser and remove if unused.

- **#49 `@uiw/react-markdown-editor`**: Pulled in as a heavy editor dependency (CodeMirror-based). It is dynamically imported which mitigates the bundle size impact, but the `@uiw/react-md-editor` package name in `transpilePackages` differs from the actual package name `@uiw/react-markdown-editor`, suggesting a stale or incorrect config entry.

- **#50 `next: 16.1.6`**: This is a non-standard version number. The latest stable Next.js 14 series is `14.x`; version `16` does not correspond to any public Next.js release at the time of this analysis. Verify this is intentional (a custom fork or pre-release) and document accordingly.

- **#51 `react-hook-geolocation`**: Last published in 2021 (`^1.1.0`), has no TypeScript types bundled, and has an open issue regarding React 18 Strict Mode double-invocation causing duplicate geolocation requests. Review whether the native `navigator.geolocation` API with a simple custom hook would be sufficient.

---

## Security

- **#52 `pages/_app.tsx` (lines 106–109)**: The Yandex Metrika and Google Analytics scripts are injected via `dangerouslySetInnerHTML` as a raw HTML string. The string contains inline `<script>` tags with hardcoded tracking IDs. While the content is static and not user-controlled, the approach bypasses Next.js's CSP mechanisms and script optimisation. Use `next/script` with `strategy="afterInteractive"` instead, which also defers execution correctly and supports nonce-based CSP policies.

- **#53 `api/authSlice.ts` (line 36)**: The auth token cookie is set with `setCookie(LOCAL_STORAGE.AUTH_TOKEN, true)` — storing the boolean `true` rather than the actual token. The cookie is used by the middleware to determine authentication, meaning any user who can set a cookie named `token` to any truthy value can bypass the client-side route guard. The cookie should store a non-guessable value (or better, rely solely on the HttpOnly session cookie managed server-side).

- **#54 `api/api.ts` (line 29)**: The `Authorization` header is set to the raw token string without a `Bearer` prefix (`headers.set('Authorization', token)`). While this is a server-side API contract choice, it deviates from the standard `Authorization: Bearer <token>` format and should be verified as intentional.
