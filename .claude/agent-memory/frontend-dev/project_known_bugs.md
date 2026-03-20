---
name: geometki-client-known-bugs
description: Known bugs identified in the geometki client codebase during March 2026 audit
type: project
---

Critical bugs found during the March 2026 codebase audit (see ROADMAP.md for full detail):

1. **Auth cookie stores `true` not the token** (`api/authSlice.ts` line 36) — `setCookie(LOCAL_STORAGE.AUTH_TOKEN, true)`. Middleware reads this cookie; any user setting a `token` cookie bypasses client-side guards.

2. **Stale closure in infinite scroll** (`pages/index.tsx` and `pages/users/[id]/index.tsx`) — `setActivityCache([...(activityCache || []), ...data.items])` should use functional updater form.

3. **`useEffect` with no dependency array on auth redirect** (`pages/auth.tsx` line 37) — causes redirect on every render.

4. **MapEvents fires on every render** (`components/common/interactive-map/MapEvents.tsx`) — `useEffect(() => { onChangeBounds?.() })` has no dependency array.

5. **`removeMarkdown` regex partially broken for images** (`functions/helpers.ts`) — the link regex `/\[([^\]]+)\]\([^)]+\)/` runs before the image regex `/!\[([^\]]*)\]\([^)]+\)/`. For `![alt text](url)`, the link regex matches `[alt text](url)` first, leaving a leading `!`, so the final output is `!alt text` instead of `alt text`. Images with empty alt `![]()` work correctly because the link regex requires `[^\]]+` (1+ chars). This broken behaviour is now documented by tests in `functions/helpers.test.ts`.

6. **`context.params?.slug?.[0]` on a `[id]` route** (`pages/places/[id]/edit.tsx` line 115) — the SSR handler reads `slug` instead of `id`, so SSR data fetch always returns `notFound`. Bug is masked because the component receives `place` data via navigation context. Fix: change to `context.params?.id`.

7. **`setTimeout` side effect inside `createAsyncThunk`** (`api/notificationSlice.ts` lines 20–26) — non-cancellable timer for auto-dismissing notifications. Should use `createListenerMiddleware` with `listenerApi.delay()`.

8. **Cookie/localStorage writes inside reducers** (`api/authSlice.ts` lines 36–41, 48–50; `api/applicationSlice.ts` line 43) — side effects in Immer-managed case reducers break Redux purity contract. Should be moved to listener middleware.

Additional hooks & i18n issues found in the 2026-03-19 React Hooks & i18n Audit (ROADMAP #76–#109):

- `pages/_app.tsx` line 37: `useEffect([])` stale-closes over `router` and `i18n.language` for locale redirect (#76)
- `components/common/photo-uploader/PhotoUploader.tsx`: `URL.createObjectURL` calls never revoked — memory leak (#79)
- `components/pages/place/place-form/PlaceForm.tsx`: `debounceSetMapBounds` recreated on every `formData` change, drops pending debounce calls (#82)
- `pages/404.tsx`: no translations at all — hardcoded English strings, no `serverSideTranslations` (#99)
- All pages: `serverSideTranslations(locale)` called without explicit namespace array (#103)
- Multiple components (`AppBar`, `AppLayout`, `LoginForm`, `NotificationList`, `SearchControl`): reference non-existent namespace files — rely entirely on `defaultValue` fallbacks (#104)
- `public/locales/en/common.json` vs `ru/common.json`: key `input_description` and `notification-list-cleared` missing from RU; `notification-list-has-been-cleared` missing from EN (#102)

**SEO audit completed 2026-03-20** — 15 issues fixed across 16 commits on `develop` (commits e2355677..2f9d7aa4). Outstanding items not implemented:
- SEO-22: Migrate web fonts to `next/font` (no external font imports found — may already be non-issue)
- SEO-25: Homepage activity feed infinite scroll (low priority)

**Why:** Tracking these to avoid re-introducing them or wasting time re-diagnosing.
**How to apply:** When editing any of these files, check whether the bug has been fixed first before building on top of the broken logic.
