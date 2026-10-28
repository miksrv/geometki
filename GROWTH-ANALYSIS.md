# Geometki — Growth & UGC Analysis

> Goal: a self-populating site where users generate the content. Only open items are listed.
> This sets the order of work for `ROADMAP.md`: activation and acquisition first, retention after.

## Diagnosis

On 2026-10-06: 1,169 places, 1,191 registered users, almost all content from the owner account. Conversion from "registered" to "added a place or a photo" is close to zero; the only write action at scale is anonymous rating — actions without login happen, actions behind login do not.

Positioning: **a map of unusual and wild places in Russia with GPS coordinates — abandoned sites, mountains, caves, natural tracts, remote monuments — from people who have actually been there.** Principles: visible empty slots that ask to be filled, micro-contributions without registration (login at the end, with a reason), search as the main source of authors.

## UX friction on the path to the first contribution

1. The interrupted action does not resume after login; the login dialog has no context ("Sign in to upload a photo").
2. The create form is heavy: no address search, no manual coordinate input, default map centre is Orenburg (`DEFAULT_MAP_CENTER` in `components/map/InteractiveMap.tsx`) instead of the user's location, a full markdown editor, no drafts.
3. Photos do not become places: the server stores EXIF GPS in `photos.lat/lon`, the client never uses it. HEIC is rejected; no client-side compression.
4. Passive empty states: no "Be the first, +10 XP"; empty search / list have no "Didn't find it? Add it".
5. No onboarding after registration.
6. No About, Rules, Privacy Policy or content licence pages; no consent checkbox at registration.
7. Logged-in users see "Delete / Rotate" on other people's photos (`PhotoGallery` checks only `isAuth`); the server rejects it.
8. "Create geotag" in the map context menu is hidden from anonymous users with no hint it exists.

## Technical gaps

1. Open wiki editing without moderation: no API or UI for history, diff or revert of `places_content` (only the CLI `content:revert`); the `moderator` role is unused.
2. Anti-spam only on login: `ThrottleFilter` covers only `auth/login` and `auth/registration`; no limits on places, photos, comments; no reports, bans, content hiding, comment deletion or captcha.
3. Deduplication only on an exact `user_id + lat + lon` match.
4. No radius geosearch or spatial index.
5. No export or embed (GeoJSON, GPX, KML, RSS, widget).
6. Anonymous votes change the author's reputation; changing a vote adds reputation again.
7. EXIF not stripped from originals; temp uploads never cleaned.

## Plan

**Stage 1 — first-contribution funnel**

1. Login dialog with the action context; resume the action after login.
2. Quick "Add place from photo": photo → EXIF coordinates → title → category; HEIC, client-side compression.
3. Form map: address search, manual coordinates, start from geolocation.
4. Active empty states with XP and an action link; "Didn't find it? Add the place" on empty search.
5. Photo upload and edit suggestions without login, finished with a magic-link login.
6. About, Rules, Privacy Policy, Content Licence (CC BY-SA); consent checkbox at registration.
7. Metrika goals: registration, first place, first photo, first edit.

**Stage 2 — slots and traffic**

1. OSM candidates as stubs: a "Needs help" section, `noindex` until a place has a photo and a description.
2. GPX/KML export by region, category and bookmarks.
3. Embeddable map widget.
4. Auto-posting new places to Telegram and VK.
5. Minimal moderation: write rate limits, reports, comment deletion, a "recent edits" feed, version rollback.

**Stage 3 — retention** (after 20–30 active contributors a month): `ROADMAP.md`.

## Acquisition channels

- Long-tail queries ("coordinates of …", "how to get to …") — place, category and location pages.
- Local-history and off-road communities on VK and Telegram (Urals, Volga): import their points with attribution and a link back.
- Travel bloggers with GPS tracks: widget and export.
- "Create a place from this article / old photo" on the Pastvu, Wikipedia and Commons layers.

## Metric

People who make their first contribution per month: baseline 1–2, target 20. Secondary: share of contributions not by the owner, share of places with a photo and a description, Metrika funnel "place page → contribute → login → submit".
