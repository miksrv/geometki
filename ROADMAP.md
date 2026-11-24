# Geometki — Retention Roadmap

> Product strategy, not a backlog: every item is a reason for a user to come back. Only open items are listed.
> Order of work: see `GROWTH-ANALYSIS.md` — activation and acquisition come first; most of this assumes an active community.

The game (2.0.0, `features/26`) answers "toward what": seasons of confirmed visits, quests, the explored share of every region and town. What follows builds around it.

## Between sessions

- **Activity streaks + XP multiplier.** Consecutive active days, multiplier tiers, a flame counter next to the level, a "streak ends tonight" email. Today a streak is only an achievement condition (`login_streak`). Spec: feature 03 — decide first whether it competes with the season's geopoints.
- **Level-up ceremony.** A full-screen moment on level-up with the next level preview; driven by the existing `level` notification and `GET /levels`. Frontend only.

## Around the game

- **Place quality tiers with decay, curator rank.** Stub … Exemplary on place cards, degrading without updates; a one-time bonus to those who brought a place up a tier. Spec: feature 15.
- **Follow system and personal feed.** Follow users, "Following / Global" on the feed, new-follower notification. Spec: feature 12.
- **Champions of a location.** The #1 of a season in a town or a region named on its places page and the profile; "you have been overtaken" in-app notification. The rating by location exists (`GameLibrary::table()`).
- **Place outlines in the admin.** See the OSM outline of a place (`places_outlines`, `php spark places:outlines`) on its map, draw or correct it, take another OSM object or none; a list of the large places without one (`source` null).
- **Social kudos** — peer endorsements, one per type per recipient per month. Spec: feature 07.

## Map as a tool

`/map` should be where users plan trips, not just browse markers. nakarte-style tools (panoramas, elevation profile, azimuth, GPX) are in feature 23.

- **Personal layers.** "All / Visited / Bookmarked / Mine" on the map, a check mark on visited markers. `ListRequest` already takes `visited`, `bookmarks`, `author`; `pages/map.tsx` passes only categories.
- **Collection as a map layer.** `/map?collection=<id>` shows only its places and fits the bounds.
- **More filters:** photos only, minimum rating, new this month.
- **Viewport list panel.** Places in the current view as cards (side panel / bottom sheet), hover highlights the marker.
- **Map search.** Jump to a city or address via the server geocoder, with our places in the results.
- **"What's here?" in the context menu.** Address, nearest places, Wikipedia and Commons for a clicked point.
- **Trip planner** (the word «маршрут» is kept for it). Pick places, build a road route (OSRM / GraphHopper / ORS), save as a collection, export GPX.
- **Personal exploration map.** On the profile map: the browser-side hexes of `/map` below zoom ~11 (darker the more of a cell's places the person explored), the white spots they opened as a fourth set. `users.last_lat/last_lon` are stored for it.
- **Admin linking tool.** A page under `/admin` for OSM candidates that look like an existing place (`status = duplicate`): the pair side by side, link / unlink / reject (the endpoints exist), filters by region and tier.

## Quick wins

- **"Your place was viewed N times this week"** notification at 20+ views a week (views are logged).
- **Category completion progress:** "You've explored 3 of 47" in the category filter or on the profile.
- **Weekly digest sections** still missing: feature 16.

## Profile ideas

Collected 2026-11-08; not specced. Suggested order: privacy → about and region → follows → reviews.

- **Privacy of bookmarks and visits.** A setting "Show bookmarks / visits: everyone or only me".
- **"About" and home region** in the card's facts line; the region later feeds "people nearby" and the default scope of the season's rating.
- **The person's reviews** gathered in one place: a fifth set of "Места" or a block on the overview.
- **Share a profile** and an `og:image` of it (avatar, name, level, numbers).
- **The author's best places:** 3–6 by rating or views on the overview.
- **In common with you:** "you have both been to 4 places", "12 of their places you have not seen yet".
- **Report / hide a user** in a "⋯" menu, before follows and reviews make it needed.

## Metrics

D1 and D7 retention, 30-day active rate, sessions per active user per week, players with a counted place per season.
