# Geometki — Growth & UGC Analysis

> **Date:** 2026-10-06 (open items rechecked 2026-10-10).
> **Goal:** turn Geometki into a self-populating site where users generate the content.
> Only open findings and plans are listed; what has shipped since is removed.

This document sets the order of work for `ROADMAP.md`: retention is the wrong first problem. Activation and acquisition come first.

---

## 1. Diagnosis: the content is produced by one person

Snapshot from the live site on 2026-10-06:

| Metric | Value |
|---|---|
| Places | 1,169 |
| Registered users | 1,191 |
| Places created by the owner account | 382 |
| Second-largest contributor | 67 places, inactive for 3 months |
| Named authors in the activity feed over the last month | 1 |
| Anonymous ("Guest") ratings over the last month | dozens |

Conversion from "registered" to "added a place or a photo" is close to zero. The only write action people do at scale is **anonymous rating**, the one that does not require login: actions without login happen, actions behind login do not.

Order of work:

1. Make the **first contribution** painless (activation).
2. Bring **search traffic** to place pages (acquisition).
3. Only then build retention loops.

---

## 2. Positioning

Generic "interesting places of Russia" competes with Yandex Maps, Tripster, Kultura.rf and others and cannot win. The data says the audience is people with 4x4s and backpacks who need GPS coordinates and "how to get there" (top content: abandoned sites, mountains and rocks, caves, military objects, springs; geography: Urals, Bashkortostan, Orenburg region). That audience has no single home.

> **A map of unusual and wild places in Russia with GPS coordinates: abandoned sites, mountains, caves, natural tracts, remote monuments — from people who have actually been there.**

Principles of a self-populating site:

1. **Visible empty slots that ask to be filled** (Wikipedia's red links): stubs, "no photo" / "no description" as a call to action.
2. **Micro-contributions without registration**, login requested at the end with a reason.
3. **Search as the main source of authors**: someone lands on a place they know better and fixes it.

---

## 3. UX friction on the path to the first contribution

1. **The hero CTA "Add place" silently sends anonymous users to the places list.** `sections/home/map-hero/MapHero.tsx` links to `/places/create` without an auth check; `proxy.ts` redirects to `/places` with no message.
2. **The interrupted action does not resume after login.** Password login just closes the dialog.
3. **The login dialog has no context** ("Sign in to upload a photo").
4. **The create form is heavy.** No address search, no manual coordinate input, default map centre is Orenburg (`DEFAULT_MAP_CENTER` in `components/map/InteractiveMap.tsx`) instead of the user's location, a full markdown editor instead of a plain text field, no drafts.
5. **Photos do not become places.** The server stores EXIF GPS in `photos.lat/lon`, the client never uses it. HEIC is rejected; no client-side compression.
6. **Empty states are passive.** No "Be the first, +10 XP"; empty search / empty list have no "Didn't find it? Add it".
7. **No onboarding** after registration.
8. **Trust and legal gaps.** No About, Rules, Privacy Policy or content licence pages; no consent checkbox at registration.
9. Logged-in users see "Delete / Rotate" on other people's photos on the place page (`PhotoGallery` checks only `isAuth`); the server rejects it with an error.
10. The geolocation prompt appears on any page on first visit, with no context (`useGeolocation()` in AppBar).
11. "Create geotag" in the map context menu is hidden from anonymous users with no hint it exists.

---

## 4. Technical gaps that will block growth

1. **Open wiki editing without moderation or rollback.** Any logged-in user can change any place (`Places::update`). Versions go to `places_content`, but there is no API or UI for diff, history or revert. The `moderator` role exists in `users.role` and is used nowhere.
2. **Anti-spam only on login.** `ThrottleFilter` covers only `auth/login` and `auth/registration`. No limits on places, photos or comments; no reports, bans or content hiding; comments cannot be deleted (no endpoint); no captcha.
3. **Weak deduplication.** Duplicates are detected only as an exact match of `user_id + lat + lon`.
4. **No radius geosearch, no spatial index.** "Nearby places without photos" cannot be computed cheaply.
5. **No export or embed.** No GeoJSON, GPX, KML, RSS or embed widget.
6. **Ratings are gameable.** Anonymous votes change the author's reputation; changing a vote adds reputation again.
7. `system:generate-users-online` fakes online status for `@geometki.com` accounts — a trust risk if it runs in production.
8. Smaller: EXIF not stripped from originals (privacy), temp uploads never cleaned, cron schedule exists only in doc comments, `visit` gives no XP.

Assets already in the code to build on: versions in `places_content` (history, rollback, review queue), the `moderator` role and soft deletes, OSM candidates (stubs), Pastvu / Wikipedia / Wikimedia Commons layers ("create a place from this article / old photo"), EXIF GPS + `GET /poi/photos` ("create a place from a photo"), achievements with seasonal windows and `DigestService` (campaign tooling).

---

## 5. Plan by priority

### Stage 1: fix the first-contribution funnel

1. Hero CTA with an auth check; login dialog with the action context; resume the action after login.
2. **Quick "Add place from photo" form:** photo → coordinates from EXIF → title → category. Accept HEIC, compress on the client.
3. Form map: address search, manual coordinate input, start from geolocation.
4. Active empty states on the place page with XP and an action link; "Didn't find it? Add the place" on empty search.
5. Allow photo upload and edit suggestions without login, finished with a magic-link login on submit.
6. Pages: About, Rules, Privacy Policy, Content Licence (proposed CC BY-SA); consent checkbox at registration.
7. Yandex.Metrika goals: registration, first place, first photo, first edit.

### Stage 2: create slots and traffic

1. **Make OSM candidates work as stubs:** a "Needs help" section, `noindex` until a place has a photo and a description.
2. **GPX/KML export** by region, category and personal bookmarks.
3. **Embeddable map widget** for bloggers and local-history communities.
4. **Auto-posting new places to a Telegram channel and VK.**
5. Minimal moderation: write rate limits, report on place and photo, comment deletion, a "recent edits" feed, version rollback.

### Stage 3 (after 20–30 active contributors per month): retention

Return to `ROADMAP.md`: following authors and regions, freshness badges, challenges like "fill the stubs in your district". Streaks, territory, seasonal events, social kudos and fog of war come last.

---

## 6. Acquisition channels

- Long-tail queries: "coordinates of …", "how to get to …", "abandoned … where is it" — covered by place, category and location pages.
- Local-history and off-road communities on VK and Telegram in the Urals and Volga region: import their points with attribution and a link back.
- Travel bloggers with GPS tracks: the widget and export give them value.
- A "create a place from this article / this old photo" button on the Pastvu, Wikipedia and Commons layers.

---

## 7. What to measure

One goal for the quarter: **people who make their first contribution per month**. Baseline 1–2, target 20.

Secondary: share of contributions not made by the owner (≈35% at baseline), share of places with both a photo and a description, Metrika funnel "place page → contribute → login → submit".
