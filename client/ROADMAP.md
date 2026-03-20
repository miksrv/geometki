# Client Roadmap

This document catalogues bugs, performance issues, code quality problems, accessibility gaps, and missing test coverage found during a thorough review of the Next.js client codebase.

---

## Code Quality

- **#19 `next.config.js` (line 7)**: `reactStrictMode: false` is disabled with the comment "Authorization does not work in this mode". Strict Mode double-invocation of effects exposes real bugs (like the side effects in Redux slices). The root cause should be fixed and Strict Mode re-enabled.

- **#22 `pages/places/create.tsx`, `pages/places/[id]/edit.tsx`, `pages/users/settings.tsx`**: All three pages cast `validationErrors as any` when passing to form components. The `PlaceForm` and `UserForm` accept `errors?: ApiType.*.PostItemRequest` but the API returns a `Record<keyof T, string>`. A proper error type should be defined and threaded through instead of silencing the type system.

- **#25 `components/common/interactive-map/coordinates-control/CoordinatesControl.tsx`**: The labels `Lat:` and `Lon:` are hardcoded English strings, not passed through i18n.

- **#28 `api/apiPastvu.ts`**: Defines its own local types (`Photo`, `RequestNearestGetPhotos`, `ResponseNearestGetPhotos`) that are not shared with the rest of the model layer. The types should live in `api/models/` for consistency.

- **#29 `functions/coordinates.ts`**: Uses the old `function()` syntax throughout and suppresses TypeScript errors with `// @ts-ignore` in multiple places. Migrating to arrow functions and proper generics would remove the suppressions.

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

- **#43 `functions/localstorage.ts`**: No tests. The module wraps all localStorage access for the app; errors here affect authentication persistence, locale detection, and map state. Edge cases (corrupted JSON, SSR environment, missing keys) should be tested.

- **#45 `middleware.ts`**: The route-guard middleware has no tests. It protects `/places/create` and `/users/settings` from unauthenticated access; regression coverage would catch any breakage during refactors.

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

---

## Redux Toolkit Audit (2026-03-19)

### Critical Issues

- **#55 `api/notificationSlice.ts` (lines 11–31) — Side effects inside `createAsyncThunk` via `setTimeout`**: The `Notify` thunk schedules a `setTimeout` directly inside the thunk body to auto-dismiss notifications after 10 seconds. `setTimeout` inside a thunk is non-cancellable, leaks across hot reloads, and is untestable. The correct RTK pattern is to use `createListenerMiddleware` with `listenerApi.delay()`, which is cancellable and integrates cleanly with the Redux lifecycle. Fix: create a `listenerMiddleware`, add it to the store via `getDefaultMiddleware().prepend(listenerMiddleware.middleware)`, then replace `Notify` with a plain action creator and register a listener that calls `await listenerApi.delay(10000)` before dispatching `deleteNotification`.

- **#56 `api/authSlice.ts` (lines 29–51) — Side effects (cookie writes, localStorage writes) inside `createSlice` reducers**: The `login` and `logout` reducers call `setCookie`, `deleteCookie`, `LocalStorage.setItem`, and `LocalStorage.removeItem` directly inside Immer-managed case reducers. Redux reducers must be pure and free of side effects; this violates the core Redux contract, breaks time-travel debugging, and makes tests unreliable. Fix: move all storage and cookie operations into a `createListenerMiddleware` listener that fires after the `login`/`logout` actions, keeping the reducer itself a pure state mutation.

- **#57 `api/applicationSlice.ts` (line 43) — Side effect (cookie write) inside a `createSlice` reducer**: The `setUserLocation` reducer calls `setCookie` inside the Immer case reducer body, the same class of violation as #56. Fix: move the `setCookie` call to a listener middleware effect triggered by the `setUserLocation` action.

- **#58 `api/store.ts` (lines 36–41) — HYDRATE merges RTK Query cache with a plain object spread, losing query status metadata**: The HYDRATE handler merges `payload[API.reducerPath]` and `payload[APIPastvu.reducerPath]` with a shallow spread (`{ ...state?.[API.reducerPath], ...payload[API.reducerPath] }`). RTK Query's internal cache state contains `queries`, `mutations`, `provided`, `subscriptions`, and `config` sub-keys; a bare spread of two top-level objects can produce inconsistent state where subscription counts or query statuses from the client are silently overwritten. The canonical approach from the RTK docs is to use the `extractRehydrationInfo` hook on `createApi` (already present in `api.ts`) and let RTK Query handle its own slice during HYDRATE, removing the manual spread in the root reducer entirely. The API keys in the HYDRATE block of `rootReducer` should be removed and deferred to `extractRehydrationInfo`.

### Best Practice Improvements

- **#59 `api/api.ts` — `poiGetItem` is a mutation but performs a read (`builder.mutation` on a GET endpoint)**: `poiGetItem` (line 270) is declared as `builder.mutation` even though it fetches a single POI item — a side-effect-free read operation. Using a mutation for a read disables all caching, deduplication, and automatic re-fetching that RTK Query provides for queries. Fix: convert to `builder.query` and add appropriate `providesTags`.

- **#60 `api/api.ts` — `locationGetGeoSearch` and `locationGetSearch` are mutations for read operations**: Both endpoints (lines 142–147) are search queries that return data and have no server-side mutations; they are declared as `builder.mutation` solely to allow repeated calling without caching. The correct approach for this use case is `builder.query` with `keepUnusedDataFor: 0` (or a very short TTL) and `refetchOnMountOrArgChange: true` at the call site, or — if truly ephemeral — keep as mutations but document the trade-off. As-is, the results are never cached or tagged, so any related cache invalidation will have no effect on them.

- **#61 `api/api.ts` — `categoriesGetList` and `tagsGetList` have no `providesTags`**: These two list queries (lines 108–109, 311–313) return reference data that is shared across many pages but carry no `providesTags` declaration. If a mutation ever invalidates `'Categories'` or `'Tags'`, the UI will not automatically refetch. Add `providesTags: ['Categories']` and `providesTags: ['Tags']` respectively, and add corresponding `tagTypes` entries.

- **#62 `api/api.ts` — `placeDelete` mutation (line 240) has no `invalidatesTags`**: Deleting a place does not invalidate the `Places` list or `Activity` cache, so the UI will not automatically remove the deleted place from any displayed list until the next full page reload. Fix: add `invalidatesTags: (res, err, id) => [{ type: 'Places', id }, { type: 'Places' }, { type: 'Activity' }]`.

- **#63 `api/api.ts` — `levelsGetList`, `sitemapGetList`, `poiGetList`, `poiGetPhotoList`, `poiGetUsers`, `ratingGetList`, `ratingGetHistory` have no `providesTags`**: These query endpoints return data that could become stale after related mutations (e.g. a user levelling up, a new place being added). Without `providesTags`, targeted cache invalidation is impossible. Each should be tagged with the appropriate entity type so mutations can invalidate them specifically.

- **#64 `api/notificationSlice.ts` (lines 40–43, 54–63) — Unnecessary array spread instead of direct Immer mutation in `addNotification` and `setReadNotification`**: Both reducers replace the entire `state.list` array with a spread copy (`state.list = [...state.list, payload]` and `state.list = [...filtered, {...notification, read: true}]`). Inside `createSlice`, Immer allows direct mutation — `state.list.push(payload)` and mutating the found item in-place — which is both more readable and avoids allocating new arrays. The current approach is not wrong, but it bypasses the Immer integration and is inconsistent with how the rest of the codebase writes to nested state (compare `activityGetInfinityList.merge` which calls `currentCache.items.push()`).

- **#65 `api/store.ts` (line 67) — `devTools` guard should use `configureStore`'s built-in default**: `configureStore` already enables Redux DevTools only in development by default; the explicit `devTools: process.env.NODE_ENV !== 'production'` is harmless but redundant. More importantly, if the team later needs to pass a `DevToolsOptions` object (e.g. `{ name: 'Geometki', maxAge: 100 }`), this pattern makes that harder. Consider removing the guard and relying on the default, or using a `DevToolsOptions` object if configuration is needed.

- **#66 `api/store.ts` (lines 36–37) — `combinedReducer(undefined, { type: '' })` called three times during each HYDRATE**: The HYDRATE handler calls `combinedReducer(undefined, { type: '' })` three separate times to obtain fallback initial state values. Each call runs every reducer's initialisation logic (including the side-effectful `getStorageToken()` and `getStorageLocale()` calls via slice `initialState` factories). Extract the initial state once into a module-level constant to avoid repeated execution.

- **#67 `api/apiPastvu.ts` — Second `createApi` instance (`APIPastvu`) has no `extractRehydrationInfo`**: `APIPastvu` is registered in the store and its reducer is spread during HYDRATE (store.ts line 53–56), but `APIPastvu` does not have an `extractRehydrationInfo` hook unlike the main `API`. This means RTK Query's internal cache reconciliation for Pastvu data is bypassed and only the manual shallow spread applies. Fix: add the same `extractRehydrationInfo` pattern used in `api.ts` to `apiPastvu.ts`, and then remove the manual spread for `APIPastvu.reducerPath` from the `rootReducer` HYDRATE block.

- **#68 `pages/index.tsx` and `pages/users/[id]/index.tsx` — Infinite scroll implemented with a raw `document.addEventListener('scroll', ...)` instead of an RTK Query-native pattern**: Both pages manually manage scroll state to trigger `activityGetInfinityList` pagination. The scroll handler is re-registered via `useEffect` every time `isFetching` or `data` changes (because `onScroll` is a `useCallback` dependency of the effect). A more robust pattern would be to use an `IntersectionObserver` sentinel element, which avoids the repeated add/remove cycle and does not require `onScroll` to be in the `useEffect` dependency array.

### Performance Improvements

- **#69 `components/common/app-layout/app-bar/AppBar.tsx` (line 30) — Entire `auth` slice selected in one `useAppSelector` call**: `AppBar` selects the entire `auth` object (`useAppSelector((state) => state.auth)`). If any property of `auth` changes (including unrelated ones like `session`), this component re-renders. Split into targeted selectors — `state.auth.isAuth` and `state.auth.user` — so renders only trigger when the specific values used in the template change.

- **#70 `api/api.ts` (lines 50–55) — `activityGetInfinityList` `merge` callback mutates `currentCache.items` but also reassigns the whole array on reset**: The reset branch (`currentCache.items = newItems.items`) replaces the entire array reference, which is valid inside RTK Query's Immer-powered merge. However, note that `newItems.items` is a reference to the normalized cache's internal data; if consumers mutate it downstream, cache corruption can occur. The append branch correctly uses `push`. Both branches are fine but it is worth adding a note that `newItems.items` should never be mutated by consumers.

- **#71 `pages/map.tsx` (lines 94–113) — `debounceSetMapBounds` and `debounceSetMapCategories` `useCallback` wrappers have empty dependency arrays**: Both `useCallback(debounce(...), [])` calls create a debounced function once and never recreate it. While this is the intended behaviour (stable debounce reference), the `updateUrlCoordinates` function called inside `debounceSetMapBounds` closes over `router` at creation time. If `router` changes identity across renders (which Next.js's `useRouter` can do), the stale reference inside the debounce will call `router.replace` on an old router instance. Fix: use `useRef` to store the latest `router` and dereference it inside the debounce callback, or use the `useEvent`/stable callback pattern.

### TypeScript / Type Safety

- **#72 `api/api.ts` (line 370) — `extractRehydrationInfo` return type annotated as `: any`**: The function is annotated with an `eslint-disable` comment suppressing the `@typescript-eslint/no-explicit-any` rule and returns `: any`. The correct return type is `RootReducerState['api'] | undefined` (i.e. the RTK Query cache slice type). Fixing this makes the HYDRATE reconciliation type-safe and allows TypeScript to catch mismatches between the payload shape and the expected cache structure.

- **#73 `api/store.ts` (line 25) — Manual `rootReducer` type annotation duplicates what TypeScript can infer**: The function signature of `rootReducer` is explicitly typed as `(state: RootReducerState | undefined, action: UnknownAction) => RootReducerState`. Since `combinedReducer` already infers this signature, the explicit annotation is redundant and creates a maintenance burden — if the combined reducer shape changes, the annotation must be updated manually. Removing the annotation and letting TypeScript infer will keep the types in sync automatically.

- **#74 `api/notificationSlice.ts` (line 21) — `getState()` cast to `RootState` inside `createAsyncThunk` without typing the thunk API**: The thunk casts `getState() as RootState` (line 21) because `createAsyncThunk` defaults to `unknown` for `getState`. The correct fix is to type the thunk using the RTK typed `createAsyncThunk` helper: `const createAppAsyncThunk = createAsyncThunk.withTypes<{ state: RootState; dispatch: AppDispatch }>()` and use `createAppAsyncThunk` in place of `createAsyncThunk`. This eliminates the cast and makes the state type propagate automatically to all future thunks.

- **#75 `pages/places/[id]/edit.tsx` (line 115) — `context.params?.slug?.[0]` used on a route named `[id]`**: The edit page's `getServerSideProps` reads `context.params?.slug?.[0]` to get the place ID, but the route file is located at `pages/places/[id]/edit.tsx`, meaning the dynamic segment is named `id`, not `slug`. This will always yield `undefined`, causing the `notFound: true` branch to fire for every request. The correct accessor is `context.params?.id`. This is a latent bug masked by the fact that `placeData` is passed as a prop from the parent navigation context in practice, but it would cause the SSR data fetch to silently fail.

---

## React Hooks & i18n Audit (2026-03-19)

### React Hooks — Critical Issues

- [ ] **#76 `pages/_app.tsx` (line 37) — `useEffect` with empty deps silences stale-closure over `i18n`, `locale`, and `router`**: The locale-redirect effect has `[]` as its dependency array, but it reads `i18n.language`, the module-level `locale` constant, and calls `router.replace`. The `router` object is captured at mount time. If `locale` changes (e.g. a second render before hydration completes) or `router` is replaced, the effect will not re-run and the redirect will use a stale router instance. Fix: add `[i18n.language, router]` to the dependency array, or gate on `locale` via a `useRef` so the effect only fires once but reads the latest router.

- [ ] **#77 `pages/places/[id]/index.tsx` (line 153–155) — `useEffect` with `[photoList]` synchronises props into state — derived-state anti-pattern**: The effect `useEffect(() => { setLocalPhotos(photoList ?? []) }, [photoList])` exists only to copy a prop into state whenever it changes. This is the classic derived-state anti-pattern; it causes an extra render cycle on every `photoList` change. Fix: initialise `localPhotos` from `photoList ?? []` in `useState` and only use `setLocalPhotos` for the mutation case (`onUploadPhoto`). The effect can be removed entirely.

- [ ] **#78 `components/common/app-layout/app-bar/AppAuthChecker.tsx` (lines 26–45) — two `useEffect`s with missing dependencies produce stale closures**: The first effect (lines 26–39) depends on `meData?.auth`, but also reads `session`, `setSession`, and `dispatch` without listing them as dependencies. The second effect (lines 41–45) depends on `isAuth` but also calls `refetch`, which is not in the deps array. While `dispatch` and `refetch` are stable references, `session` is mutable state from `useLocalStorage` and will stale-close. Fix: add all consumed values to each dependency array; use `useCallback` to memoize handlers if needed.

- [ ] **#79 `components/common/photo-uploader/PhotoUploader.tsx` (lines 87–93) — `useEffect` creates `Object URL`s without revoking them**: The effect at line 91 calls `URL.createObjectURL(file)` for each selected file every time `selectedFiles` changes and passes the result to `onSelectFiles`. The created object URLs are never revoked with `URL.revokeObjectURL()`, causing a memory leak for every set of files the user selects. Fix: capture the URLs in the effect, pass them to `onSelectFiles`, and return a cleanup function that calls `URL.revokeObjectURL` on each URL.

- [ ] **#80 `components/common/app-layout/login-form/LoginForm.tsx` (line 91–93) — `useEffect` with `[error]` dep synchronises derived state, masking stale `error` reference**: The effect `useEffect(() => { setFormErrors(validationErrors) }, [error])` should depend on `validationErrors` (the memoised value derived from `error`), not on `error` itself, since `validationErrors` is what is actually used. More importantly, `validationErrors` is computed from `error` via `useMemo` — the `useEffect` that syncs it into state is entirely unnecessary. `formErrors` should be computed as `validationErrors ?? localClientErrors` without a separate `useState` or synchronisation effect, eliminating the extra render cycle.

- [ ] **#81 `components/common/app-layout/registration-form/RegistrationForm.tsx` (line 83–85) — same pattern as #80**: Identical `useEffect(() => { setFormErrors(validationErrors) }, [error])` pattern. Same fix applies.

- [ ] **#82 `components/pages/place/place-form/PlaceForm.tsx` (line 122–138) — `debounceSetMapBounds` `useCallback` recreates the debounce on every `formData` change, losing pending calls**: The `useCallback(debounce(...), [formData])` pattern recreates a fresh debounce instance every time `formData` changes. Any pending debounced call from the previous instance is silently dropped, and the 100ms timer resets. This means dragging the map while typing quickly will never commit coordinates. Fix: keep the debounce instance stable (empty deps `[]`) and instead read `formData` via a `useRef` inside the debounce callback, or restructure so the map bounds event only calls `setFormData` with coordinates directly without needing `formData` in the debounce closure.

- [ ] **#83 `components/common/interactive-map/MapEvents.tsx` (lines 29–31) — `useEffect` fires `onChangeBounds` with `[mapEvents]` dependency, which triggers on every map event**: The effect calls `onChangeBounds?.(mapEvents.getBounds(), mapEvents.getZoom())` with `mapEvents` in the dependency array. `mapEvents` is the return value of `useMapEvents`, which returns the Leaflet map instance — this reference is stable in practice, but the effect is intended to fire once on mount to set initial bounds. However, `mapEvents` being in the dep array means ESLint exhaustive-deps considers it correct, while semantically it should be `[]` (run once on mount). The intent is also already handled by the `moveend` event handler above. Fix: use an empty dependency array and add a comment that this is an intentional mount-only fire, or remove the effect entirely since `moveend` fires as soon as the map renders.

- [ ] **#84 `components/common/interactive-map/InteractiveMap.tsx` (line 257–259) — `useEffect` with `[]` calls `onChangeMapType?.(mapType)` but `mapType` is captured stale**: This mount-only effect reads `mapType` (the initial `DEFAULT_MAP_TYPE`) and calls `onChangeMapType`. Because deps are `[]`, if `mapType` could ever differ at mount (e.g. if an initialiser prop were added), the effect would still send `DEFAULT_MAP_TYPE`. This is the `useEffect(fn, [])` stale-closure class of bug. Fix: either remove the effect and call `onChangeMapType?.(DEFAULT_MAP_TYPE)` as a default prop or initialise the parent from `DEFAULT_MAP_TYPE` directly, or add `onChangeMapType` to deps with `useCallback`-wrapped handler in the parent.

- [ ] **#85 `pages/users/settings.tsx` (lines 59–63 and 65–78) — two `useEffect`s missing deps**: First effect (lines 59–63) reads `authSlice.isAuth` but lists only `authSlice?.isAuth` (optional chaining on `?.isAuth` is redundant for a boolean, and `router` is not in deps). Second effect (lines 65–78) lists `[isSuccess, data]` but reads `router`, `authSlice.user?.id`, and `dispatch` — `router` is not in the deps. Fix: add `router` and `dispatch` to both effects.

### React Hooks — Best Practices

- [ ] **#86 `pages/index.tsx` (lines 39–47) and `pages/users/[id]/index.tsx` (lines 44–52) — `useEffect` adds and removes the global scroll listener on every `onScroll` change**: Because `onScroll` is a `useCallback` that depends on `[isFetching, data]`, it is recreated on every fetch cycle, which in turn triggers the `useEffect([onScroll])` to remove the old listener and add a new one. This is functionally correct but causes listener churn every time a fetch starts or ends. Prefer an `IntersectionObserver` on a sentinel element at the bottom of the list (as noted in existing #68) which eliminates this effect entirely.

- [ ] **#87 `components/common/app-layout/AppLayout.tsx` (lines 60–82) — `useEffect` with `[]` suppresses `handleResize` dependency**: The effect at line 60 adds `scroll` and `resize` listeners and calls `handleResize()` once. `handleResize` and `handleScroll` are defined as inline functions inside the effect, which is fine, but `setScrollTopVisible`, `setLeftDistance`, and `menuBarRef` are captured from the outer scope without being listed. While `setScrollTopVisible`/`setLeftDistance` are stable (React guarantees setter stability), `menuBarRef` is a ref object — its `.current` changes without triggering re-renders, which is correct behaviour. The empty dep array is legitimate but worth documenting explicitly.

- [ ] **#88 `components/common/app-layout/snackbar/Snackbar.tsx` (lines 28–34) — `useEffect` with `[data]` fires side effects (dispatching notifications) on every poll result**: The effect dispatches `Notify(item)` for every notification in `data?.items` every time the 15-second poll fires, even if the items have not changed between polls. Because RTK Query deduplications identical responses, this may re-dispatch the same notification IDs. The `Notify` thunk should check for duplicate IDs before adding, or the effect should diff against a ref of previously-seen IDs.

- [ ] **#89 `components/common/app-layout/app-bar/AppBar.tsx` (lines 44–57) — `useEffect` with `[geolocation.latitude, geolocation.longitude]` missing `dispatch` and `updateLocation` in deps**: `dispatch` and `updateLocation` are used inside the effect but are not in the dependency array. Both are stable references in practice (RTK dispatch and mutation trigger), but eslint-plugin-react-hooks will flag this. Fix: add them to the dependency array for correctness.

- [ ] **#90 `functions/hooks/useLocalStorage.ts` (lines 19–23) — `useEffect` that writes to localStorage never removes the item when state becomes falsy**: The effect only calls `LocalStorage.setItem` when `state` is truthy (`if (state)`). If `state` is set to `undefined`, `null`, `0`, or `''`, the old value remains in localStorage indefinitely. For the `RETURN_PATH` use-case the removal is handled manually (`LocalStorage.removeItem`), but other callers relying on this hook to clean up will silently leave stale data. Fix: call `LocalStorage.removeItem` in the falsy branch, or always write (including serialised `null`/`undefined`).

- [ ] **#91 `components/common/app-layout/app-bar/NotificationList.tsx` (lines 73–104) — scroll `useEffect` re-registers the listener on every `notifyPage`, `notifyFetching`, and `notifyData` change**: The inner `onScroll` function reads `notifyPage`, `notifyFetching`, `notifyData`, and `notifyContainerRef` — all of which are listed as deps. This means the listener is detached and re-attached on every fetch cycle. A `useRef` holding the latest values plus a single stable listener would be more efficient and avoids the remove-add churn.

- [ ] **#92 `components/common/app-layout/language-switcher/LanguageSwitcher.tsx` (line 38–40) — `useEffect` with `[]` dispatches `setLocale` on mount but misses `currentLanguage` and `dispatch` deps**: The intent is to synchronise the Redux locale slice with the current i18n language once on mount. The effect correctly reads `currentLanguage` which is derived from `i18n.language`, but `dispatch` is not in the deps array. Add both to deps and verify the effect is safe to run whenever `currentLanguage` changes (it is — `setLocale` is idempotent).

- [ ] **#93 `pages/auth.tsx` (lines 36–40, 42–57, 59–70) — three `useEffect`s with missing or empty dependency arrays**: First effect (lines 36–40) lists `[isAuth]` but calls `router.push` — `router` is missing. Second effect (lines 42–57) lists `[data]` but reads `dispatch`, `isProcessing`, `returnPath`, and `router` without including them. Third effect (lines 59–70) uses `[]` but calls `router.push`, `serviceLogin`, `code`, `service`, and `searchParams` — none are in deps. Fix: for each effect, add all consumed external values to the dependency array, or extract the navigation calls into dedicated event handlers.

- [ ] **#94 `pages/unsubscribe.tsx` (lines 27–31) — `useEffect` with `[]` reads `mailId` and calls `router.push` but neither is in deps**: The effect redirects to `/` if `mailId` is absent. `mailId` is derived from `searchParams.get('mail')` and `router` is used for navigation — both are missing from the empty dep array. In practice the redirect only needs to run once on mount, but ESLint exhaustive-deps will flag the stale closure. Fix: add `[mailId, router]` as deps; the condition inside (`if (!mailId)`) ensures the redirect only fires when appropriate.

- [ ] **#95 `components/pages/place/place-filter-panel/PlaceFilterPanel.tsx` (lines 46–65) — `useMemo` with incorrect dependencies**: `sortOptions` lists `[ApiType.SortFields]` as its dependency. `ApiType.SortFields` is a TypeScript enum — a module-level constant that never changes between renders. The actual runtime dependency is `userLocation?.lat` and `userLocation.lon` (used to disable the Distance sort option). Fix: replace `[ApiType.SortFields]` with `[userLocation?.lat, userLocation?.lon]`. Same issue on `orderOptions` which lists `[ApiType.SortOrders]` — `ApiType.SortOrders` never changes; the real dep is `t` (if translations are reactive) or it should have `[]` (if computed once).

### React Hooks — Performance

- [ ] **#96 `components/common/app-layout/AppLayout.tsx` (line 34) — entire `auth` slice and entire `application` slice selected in one call each**: `AppLayout` selects `state.auth` (line 33) and `store.application` (line 34) as complete objects. Any property change on either slice — including deeply nested mutations — causes `AppLayout` to re-render. Replace with targeted selectors for the specific fields used: `authSlice.user?.id`, `authSlice.isAuth`, `application.showOverlay`, `application.showAuthDialog`. This is the same class of issue as #69 (already filed for `AppBar`).

- [ ] **#97 `components/common/interactive-map/InteractiveMap.tsx` (lines 216–245) — `useEffect` with four deps re-runs full position-restore logic on every coordinates storage change**: The effect lists `[props.center, readyStorage, coordinates, placeMark]`. Every map pan/zoom updates `coordinates` via `setCoordinates`, which causes the full URL-hash parsing and `setView` logic to re-execute. The `readyStorage` guard prevents repeated `setView` calls, but the URL-hash parsing still runs on every storage write. Extract the one-time mount logic (URL hash parse + stored coordinates restore) into a separate `useEffect([])` and keep the `placeMark`-tracking logic in a separate `useEffect([placeMark])`.

- [ ] **#98 `pages/places.tsx` (lines 96–130) — `handleChangeFilter` `useCallback` depends on `initialFilter` which is re-created on every render**: `initialFilter` is a plain object literal constructed inline in the component body (lines 73–85). It is re-created on every render, so `handleChangeFilter`'s `useCallback` deps `[..., initialFilter, ...]` cause it to also be recreated every render, defeating memoisation. Fix: wrap `initialFilter` in its own `useMemo` so the reference is stable, which will make `handleChangeFilter`'s `useCallback` genuinely stable across renders.

---

### i18n — Missing Translations / Hardcoded Strings

- [ ] **#99 `pages/404.tsx` (lines 23–28) — hardcoded English strings, no `serverSideTranslations` and no `useTranslation`**: The 404 page renders `'You have gone off the map'` and `'Go back to the main page'` as hardcoded string literals. There is no `getServerSideProps` / `getStaticProps` call providing translations, and `useTranslation` is not used. This page will always display in English regardless of user locale. Fix: add `getStaticProps` with `serverSideTranslations(locale, ['common'])`, add `useTranslation`, and replace the hardcoded strings with `t()` calls.

- [ ] **#100 `components/common/app-layout/language-switcher/LanguageSwitcher.tsx` (lines 45–52) — language button labels `'Eng'` and `'Rus'` are hardcoded strings**: The two buttons render literal `'Eng'` and `'Rus'` text without going through `t()`. While language names are deliberately not translated (they serve as visual identifiers), these strings should at minimum have `aria-label` attributes (e.g. `aria-label="Switch to English"`) that go through the translation system so screen reader users in each locale hear an appropriate description.

- [ ] **#101 `components/common/interactive-map/coordinates-control/CoordinatesControl.tsx` — `Lat:` and `Lon:` labels are hardcoded English** (already noted as #25 for i18n): Confirmed via codebase scan. Additionally, the copy-to-clipboard confirmation UI text (if any) should also be checked.

- [ ] **#102 `public/locales/en/common.json` — two keys present in `en` locale are absent from `ru` locale**: The key `input_description` exists in `en/common.json` but not in `ru/common.json`. The key `notification-list-cleared` exists in `en/common.json` but not in `ru/common.json`. Conversely, `notification-list-has-been-cleared` exists only in `ru/common.json`. This mismatch means Russian users will fall back to the key string (or the `defaultValue` if one is provided) when these keys are looked up. Fix: add the missing keys to `ru/common.json` and reconcile the `notification-list-cleared` / `notification-list-has-been-cleared` discrepancy (they appear to be two names for the same string — `NotificationList.tsx` line 56 uses `notification-list-has-been-cleared`).

### i18n — namespace and `serverSideTranslations` Issues

- [ ] **#103 All pages call `serverSideTranslations(locale)` without an explicit namespace array**: Every `getServerSideProps` in the codebase (index, map, places, auth, unsubscribe, categories, tags, users, users/[id]/*, places/[id]/*, users/levels, users/settings, places/create, places/[id]/edit) calls `serverSideTranslations(locale)` with no second argument. According to next-i18next documentation the second argument should be an array of required namespace names (e.g. `['common']`). Omitting it relies on the default fallback of sending all namespaces — which works when there is only one namespace (`common.json`) but will silently over-send (or under-send, depending on next-i18next version) when additional namespaces are added. Fix: add `['common']` as the second argument to every `serverSideTranslations` call site to be explicit and future-proof.

- [ ] **#104 `components/common/app-layout/AppLayout.tsx` (line 30) — `useTranslation('components.app-layout')` references a namespace that does not exist as a file**: The component calls `useTranslation('components.app-layout')` but the only namespace files in `public/locales/` are `common.json`. There is no `components.app-layout.json` in either locale directory. The translation calls using this hook (`t('scroll-to-top', ...)`) only succeed because they include `defaultValue` fallbacks. If the `defaultValue` prop is removed or a key is renamed, the fallback will silently produce the raw key string in production. The same applies to every component that uses a non-`common` namespace: `AppBar` (`'components.app-bar'`), `Search` (`'components.app-bar.search'`), `LoginForm` (`'components.app-layout.login-form'`), `RegistrationForm` (`'components.app-bar.registration-form'`), `NotificationList` (`'components.app-bar.notifications'`), and `SearchControl` (`'components.interactive-map.search-control'`). Either create the corresponding namespace JSON files and add them to `serverSideTranslations` on each page, or consolidate all translations into `common.json` and remove the per-component namespace parameter.

- [ ] **#105 `components/pages/user/user-form/UserForm.tsx` (lines 239–243) — `Trans` component used without a `ns` prop when the namespace is `common`**: The `Trans` component renders `i18nKey={'you-logged-via-service'}` with a `values` interpolation but no explicit `ns` prop. Since `UserForm` calls `useTranslation()` without a namespace argument (falling back to `common`), the default namespace is inferred. This is technically correct, but the `Trans` component should explicitly declare `ns={'common'}` (or whatever the resolved namespace is) to make it unambiguous when component namespaces are later formalised (see #104). More critically, if the `you-logged-via-service` key uses interpolation (`{{service}}`), it must be present in both `ru/common.json` and `en/common.json` with the `{{service}}` placeholder — verify this is the case.

### i18n — Best Practices

- [ ] **#106 `pages/tags.tsx` (line 19) — component is named `CategoriesPage` but the page renders tags**: The exported default component is named `CategoriesPage` in `pages/tags.tsx`. This is a naming inconsistency that has no i18n impact but makes the file confusing to navigate. Rename to `TagsPage` to match the filename.

- [ ] **#107 `pages/users.tsx` (line 28–31) and `pages/places.tsx` (line 159–178) — `useMemo` with `i18n.language` as dep to force re-translation**: Both pages include `i18n.language` in their `useMemo` dependency arrays to force the memoised value to recompute when the locale changes. This is the correct pattern — the `t()` function reference itself is stable across locale changes but the returned strings change, so `i18n.language` is necessary as a dep for any memoised computation that calls `t()`. This pattern is correct and should be applied consistently; audit all other `useMemo` calls that invoke `t()` to ensure `i18n.language` is included in their deps.

- [ ] **#108 `pages/places.tsx` (line 161) and `pages/users/[id]/places.tsx` (line 80) — count interpolation uses string concatenation instead of `t()` interpolation**: Both pages render count values by concatenating strings: `` `${t('geotags')}: ` `` followed by `<strong>{count}</strong>`. Proper i18n would use `t('geotags_count', { count })` with the count embedded in the translation string, so translators can control the word order (e.g. in Russian the count often comes after the noun). The `geotags_count` key already exists in `common.json` (used in `pages/places.tsx` line 317) but is bypassed in the inline JSX concatenation at line 80 of `users/[id]/places.tsx` and `users/[id]/bookmarks.tsx`.

- [ ] **#109 Dynamic translation keys that cannot be statically analysed**: Multiple locations construct translation keys dynamically using template literals or variable concatenation. These cannot be verified by static analysis tools or checked for completeness against the locale files. Locations: `pages/users/levels.tsx` line 52 (`t(\`action_${key}\`)`), `components/pages/place/place-form/PlaceForm.tsx` line 33 (`useTranslation()` — key `'error_title-required'` and `'error_category-required'` are static but `t(\`checkbox_${setting}\`)` in `UserForm.tsx` line 170 is dynamic), `components/pages/place/places-filter-panel/PlaceFilterPanel.tsx` lines 53 and 62 (`t(\`sort_${sort}\`)` and `t(\`order_${order}\`)`). Recommend documenting all dynamic key families in a comment above the call site and adding a static enumeration of all possible keys in the locale file alongside the computed pattern.
