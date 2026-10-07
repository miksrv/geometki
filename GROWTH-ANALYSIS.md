# Geometki — Growth & UGC Analysis

> **Date:** 2026-10-06
> **Scope:** product idea, positioning, UI/UX, acquisition, activation, retention, technical gaps.
> **Goal:** turn Geometki into a self-populating site where users generate the content.
> **Sources:** live site (geometki.com), client code (`client/`), server code (`server/`), `ROADMAP.md`, `features/*.md`.

This document complements `ROADMAP.md`. The roadmap is about retention. This document argues that retention is the wrong first problem and describes what to build before it.

---

## 1. Diagnosis: the content is produced by one person

Numbers from the live site:

| Metric | Value |
|---|---|
| Places | 1,169 |
| Registered users | 1,191 |
| Places created by the owner account | 382 |
| Second-largest contributor | 67 places, inactive for 3 months |
| Named authors in the activity feed over the last month | 1 |
| Anonymous ("Guest") ratings over the last month | dozens |

Registration works: almost 1,200 accounts. Conversion from "registered" to "added a place or a photo" is close to zero. The only thing people do at scale is **anonymous rating**, the one write action that does not require login. That is the key signal: actions without login happen, actions behind login do not.

`ROADMAP.md` is entirely about retention: streaks, challenges, territory, seasonal events. Those mechanics are designed for a community of several hundred active contributors. Today there is nobody to retain. If streaks and challenges ship now, one player will see them.

The order has to be reversed:

1. Make the **first contribution** painless (activation).
2. Bring **search traffic** to place pages (acquisition).
3. Only then build retention loops.

---

## 2. Idea and positioning

### Current positioning

"Interesting places and sights of Russia" (`home-seo-title`). In that niche Geometki competes with Yandex Maps, Tripster, Tourister, Kultura.rf and autotravel.ru. They have millions of objects and budgets. This fight cannot be won.

### What the data actually says

Top categories: abandoned (131), mountains/rocks (113), caves (48), military objects, radiation, death sites, springs, natural tracts. Geography: Urals, Bashkortostan, Orenburg region. The audience is not tourists with suitcases. It is people with 4x4s and backpacks who need GPS coordinates and "how to get there". That audience has no single home: urban3p is abandoned-only, Wikimapia is dying, OSM has no descriptions or photos, Telegram channels have no map.

### Proposed positioning

> **A map of unusual and wild places in Russia with GPS coordinates: abandoned sites, mountains, caves, natural tracts, remote monuments — from people who have actually been there.**

"From people who have been there" makes contribution part of the promise. Today the hero subtitle only says "discover"; the word "share" appears nowhere.

### Three principles of a self-populating site (none present today)

1. **Visible empty slots that ask to be filled.** Wikipedia grew because red links are visible to everyone. Geometki has no visible gaps: no place stubs, no "no photo" markers, no "no description" as a call to action.
2. **Micro-contributions without registration.** Rating without login works. Everything else is gated. Photo upload, coordinate fix, "I was here", a short comment should start without login; login should be requested at the end, with an explanation of why.
3. **Search as the main source of authors.** An author lands on a page for a place they know better than you, sees a mistake or a missing photo, and fixes it. That needs traffic to place pages: SEO and regional stub pages.

---

## 3. UX friction on the path to the first contribution

Findings from the client audit, spot-checked in code.

1. **The hero CTA "Add place" silently sends anonymous users to the places list.** `sections/home/map-hero/MapHero.tsx` links to `/places/create` without an auth check; `proxy.ts` redirects to `/places` with no message. AppBar and BottomNav handle this correctly, the hero does not.
2. **The interrupted action does not resume after login.** Click "Add", log in, stay on the same page. Password login just closes the dialog; OAuth returns to `asPath`.
3. **The login dialog has no context.** The same dialog for every action, no "Sign in to upload a photo".
4. **The create form is heavy.** No visible marker until a category is picked (the marker is the category icon); address search on the form map is commented out; no manual coordinate input; default map centre is Orenburg (`DEFAULT_MAP_CENTER`), not the user's location; a full markdown editor with a toolbar instead of a plain text field; no drafts or autosave, only a leave-confirmation dialog.
5. **Photos do not become places.** The server extracts EXIF GPS (`Helpers/exif_helper.php`) and stores `photos.lat/lon`, but the client never uses it. HEIC and WebP are rejected (`accept="image/png, image/gif, image/jpeg"`), which is what phones produce. No client-side compression. The most natural flow for this audience ("I took a photo, upload it, the pin places itself") is unsupported.
6. **Empty states are passive.** "Description not added yet", "No photos here yet". No "Be the first, +10 XP", no visibility of such places in lists or on the map. Empty search / empty list have no "Didn't find it? Add it" CTA.
7. **No onboarding.** Nothing happens after registration: no welcome, no first-steps checklist, no hints.
8. **Trust and legal gaps.** No "About", rules, privacy policy or content licence pages (none exist in `pages/`). No consent checkbox at registration. No "forgot password" link. Content licence is absent even from the code.
9. Logged-in users see "Delete / Rotate" on other people's photos; the server rejects it with an error in the snackbar.
10. The geolocation prompt appears on any page on first visit, with no context (`useGeolocation()` in AppBar).
11. "Create geotag" in the map context menu is hidden from anonymous users with no hint it exists; the "+" map button has no label or tooltip.
12. The EN locale falls back to Russian for several components (only `common.json` exists; namespaced keys are missing).

---

## 4. Technical gaps that will block growth once it starts

From the server audit.

1. **Open wiki editing without moderation or rollback.** Any logged-in user can change title, content, category, coordinates and tags of any place (`Places::update`). Versions are written to `places_content`, but there is no API or UI for diff, history or revert. The `moderator` role exists in the `users.role` ENUM and is used nowhere.
2. **Anti-spam only on login.** `ThrottleFilter` is attached only to `auth/login` and `auth/registration`. No limits on creating places, photos, comments or tags. No reports, bans or content hiding. Comments cannot be deleted even by an admin (no endpoint). Email is not verified on native registration. Honeypot/captcha is declared but not attached.
3. **The sitemap API route is broken.** `Sitemap::index` is declared inside the `visited` group in `server/app/Config/Routes.php:222`; the client calls `GET /sitemap`. The live sitemap still responds (cache or older deploy) but will break after the next deploy of `main`. The sitemap also lacks category, tag and location pages, while including `noindex` user pages.
4. **No data import, weak deduplication.** `Libraries/OverpassAPI.php` and the 93 OSM-tag → category mappings in `overpass_category` are dead code. Duplicates are detected only as an exact match of `user_id + lat + lon`.
5. **No radius geosearch, no spatial index.** Haversine is used only for sorting; `/poi` has a bbox filter. "Nearby places without photos" cannot be computed cheaply.
6. **No export or embed.** No GeoJSON, GPX, KML, RSS, embed widget. For an audience with GPS navigators and blogs this is a missed channel.
7. **Ratings and views are gameable.** Anonymous votes change the author's reputation; changing a vote adds reputation again; `views` increments on every GET with no dedup, and trending/search ranking depend on it.
8. `system:generate-users-online` fakes online status for 30% of `@geometki.com` accounts. If it runs in production it is a trust risk. An empty community is more honest than a fake one.
9. Smaller issues: EXIF not stripped from originals (privacy), temp uploads never cleaned, vertical-photo aspect bug in `Photos.php` / `PhotosTemporary.php`, routes without handlers (`POST /photos`, `GET /activity/:id`), cron schedule exists only in doc comments, `visit` gives no XP.

### Unused assets already in the code

- `OverpassAPI.php` + `overpass_category` mapping → basis for stubs/ghost places and import.
- `Geocoder.php` (Nominatim) → address and `location_*` hierarchy for imported places and regional SEO pages.
- Versions in `places_content` → edit history, rollback, review queue.
- `moderator` role and `deleted_at` columns with soft deletes enabled in models → moderation without new migrations.
- Pastvu, Wikipedia and Wikimedia Commons client layers → "create a place from this article / old photo".
- `sessions_history` coordinates → "nothing described near you" prompts.
- Achievements engine with JSON rules and seasonal windows, `DigestService` → campaign tooling.
- EXIF GPS in `photos.lat/lon` + `GET /poi/photos` → "create place from photo".

---

## 5. Plan by priority

### Stage 1 (≈2 weeks): fix the first-contribution funnel

Without this, any traffic leaks out.

1. Hero CTA with auth check; login dialog with the action context; resume the action after login.
2. **Quick "Add place from photo" form:** upload photo → coordinates from EXIF → title → category. Everything else later. Accept HEIC and WebP, compress on the client.
3. Form map: explicit draggable marker, address search, manual coordinate input, start from geolocation.
4. Active empty states on the place page with XP and an action link. Empty search: "Didn't find it? Add the place."
5. Allow without login: photo upload and edit suggestions, stored in the session, with a magic-link login requested on submit.
6. Pages: About, Rules, Privacy Policy, Content Licence (proposed CC BY-SA). Consent checkbox at registration.
7. Yandex.Metrika goals: registration, first place, first photo, first edit. Without these the effect of everything else is invisible.

### Stage 2 (≈1 month): create slots and traffic

1. **Place stubs (ghost places) from OSM and Wikipedia** for the site's categories, via the existing `OverpassAPI` and mapping. Show them grey on the map and in a "Needs help" section. Keep stubs `noindex` until they have a photo and a description, to avoid thin content. This is both the "red links" effect and the base for SEO once filled.
2. **Regional and category SEO pages** (`features/20-location-seo-pages.md`): "Abandoned places of Bashkortostan", "Caves of Orenburg region". The `location_*` hierarchy already exists. Add them to the sitemap and fix the sitemap route.
3. **GPX/KML export** by region, category and personal bookmarks. A magnet for OsmAnd / Organic Maps users and a reason to return.
4. **Embeddable map widget** for bloggers and local-history communities: they embed the map, you get links and authors.
5. **Auto-posting new places to a Telegram channel and VK** with photo and coordinates. The channel becomes a traffic source and social proof that the site is alive.
6. Minimal moderation: write rate limits, report on place and photo, comment deletion by author and admin, a "recent edits" feed for the moderator, version rollback.

### Stage 3 (after 20–30 active contributors per month): retention

Return to `ROADMAP.md` here: weekly digest "what's new near you and on your places", following authors and regions, freshness badges, challenges like "fill the stubs in your district". Streaks, territory and seasonal events come last.

---

## 6. Acquisition channels that fit this audience

- Long-tail search queries: "coordinates of …", "how to get to …", "abandoned … where is it". Large catalogues do not compete here. Regional pages and stubs cover it.
- Local-history and off-road communities on VK and Telegram in the Urals and Volga region. Offer to import their points with attribution and a link back.
- Travel bloggers with GPS tracks: the widget and export give them value, you get content.
- Pastvu, Wikipedia and Commons are already map layers. Next step: a "create a place from this article / this old photo" button, so third-party data becomes your pages through visitors' hands.

---

## 7. What to measure

One goal for the quarter: **number of people who make their first contribution per month**. Today: 1–2. Target: 20.

Secondary:

- Share of contributions not made by the owner (today ≈65% of content is the owner's).
- Share of places with both a photo and a description (driven by stubs and empty states).
- Funnel in Metrika: visit place page → click contribute → login → submit.

---

## 8. What to defer from `ROADMAP.md`

Streaks (03), daily challenges (02), territory ownership (04), seasonal events (06), social kudos (07), fog of war (17). All of them assume an existing active community. Revisit once Stage 2 shows a steady inflow of new contributors.
