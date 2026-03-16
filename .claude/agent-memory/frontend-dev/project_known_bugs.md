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

**Why:** Tracking these to avoid re-introducing them or wasting time re-diagnosing.
**How to apply:** When editing any of these files, check whether the bug has been fixed first before building on top of the broken logic.
