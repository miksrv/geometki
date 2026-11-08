# Geometki — Retention Roadmap

> Product strategy, not a backlog: every item is a reason for a user to come back. Only open items are listed.
> Order of work: see `GROWTH-ANALYSIS.md` — activation and acquisition come first; most of this assumes an active community.

## Why users don't return

- **The world is static.** Nothing changes between visits: no streak ticks, no challenge resets, no territory shifts.
- **No goal.** XP and levels answer "how do I progress", not "toward what".
- **No trigger to return.** Only passive notifications about other people's actions on your places.
- **Contributions have no ongoing value.** A place pays off once, at creation.
- **No continuity between sessions** and no answer for the second visit.
- **No social gravity.** No follow system; the feed is a global firehose.

Target definition: *a field game for curious people — an ever-incomplete map of the real world that you explore, claim and defend, one physical visit at a time.*

## Phase 1 — thread between sessions

- **Activity streaks + XP multiplier.** Consecutive active days (`current_streak`, `longest_streak` on `users`, updated in `ActivityLibrary::push()`), multiplier tiers ×1.0 / ×1.1 / ×1.25 / ×1.5 / ×2.0, flame counter in the AppBar, stats on the profile. Today a streak exists only as an achievement condition (`login_streak`). Spec: feature 03.
- **"Streak ends tonight" email** at ~20:00 local time for users with a streak of 3+ days and no activity today.
- **Personal dashboard on the home page** for logged-in users: streak, XP to next level, daily challenges, "near you, not yet rated / visited" places (`GET /users/me/dashboard`).
- **Daily and weekly challenges.** Three daily tasks, one weekly; progress driven by activity events; `challenges` / `users_challenges` tables and a rotation cron. Spec: feature 02.
- **Level-up ceremony.** Full-screen modal on level-up with the next level preview; driven by the existing `level` notification and `GET /levels`. Frontend only.

## Phase 2 — the ongoing game

- **Exploration per location.** The undiscovered places and the pioneer bonus are live (1.18.0); still missing: the explored share of a region or district (places against the undiscovered ones), "N places wait to be discovered" there, and its top explorers. Spec: feature 25, step 5.
- **Regional leaderboards and champions.** Rankings per location on the score of feature 25 step 5 (all time / this year), the #1 of a locality or region is its champion (a badge, no passive XP), notification on being overtaken. Spec: feature 13.
- **Place quality tiers with decay, curator rank.** Stub / Draft / Complete / Verified / Exemplary on place cards, degrading without updates; a one-time bonus to those who brought a place up a tier, curator rank by the average tier; "your place dropped a tier" notification and a "needs attention" list. Spec: feature 15.
- **Seasonal events and community goals.** Themed 1–4 week events by category with tiered badges and a shared progress bar. Seasonal achievement windows already exist; events, banner and lifecycle do not. Spec: feature 06.
- **Follow system and personal feed.** Follow users, "Following / Global" toggle on the feed, new-follower notification, follower counts. Spec: feature 12.

## Phase 3 — only after Phases 1–2 are live

- **Social kudos** — peer endorsements ("Accurate mapper", "Local expert"), one per type per recipient per month. Spec: feature 07.
- **Photo contests and community albums** with voting. Spec: feature 14.
- **Streak freeze** — consumable that protects a streak for one missed day.

## Map as a tool

`/map` should be where users plan trips, not just browse markers. nakarte-style tools (panoramas, elevation profile, azimuth, GPX) are in feature 23; these build on our own content and personal data instead.

- **Personal layers.** "All / Visited / Bookmarked / Mine" toggle on the map, a check mark on visited markers. `ListRequest` already takes `visited`, `bookmarks`, `author`; `pages/map.tsx` passes only categories. "Not visited yet" needs a negative filter on the server.
- **Collection as a map layer.** `/map?collection=<id>` shows only its places and fits the bounds; "Show on map" button on the collection page.
- **More filters:** photos only, minimum rating, new this month.
- **Viewport list panel.** Places in the current view as cards (side panel on desktop, bottom sheet on mobile), sorted by rating or distance, hover highlights the marker.
- **Map search.** Jump to a city or address via the server geocoder (Nominatim + Yandex), with our places in the results.
- **"What's here?" in the context menu.** Reverse-geocoded address, nearest places, Wikipedia articles and Commons photos for a clicked point in one card.
- **Trip planner.** Pick several places, build a road route (OSRM / GraphHopper / OpenRouteService) with order, distance and travel time; save as a collection, export GPX, open in Yandex Navigator.
- **Personal exploration map.** The hex layer of `/map` (1.18.0) and one map of a person's added, visited and bookmarked places on their profile (1.19.0) are live; still missing: the hexes and the opened white spots on that map, their share of each region. Spec: feature 25, step 7.

## Quick wins

- **"Your place was viewed N times this week"** notification when a place gets 20+ views in a week (views are already logged).
- **First-session onboarding:** pin your home area → create your first place → "come back tomorrow".
- **Category completion progress** for logged-in users: "You've added 3 of 47" in the category filter or on the profile.
- **Top explorers in your city this week** on the home page, by XP earned, grouped by the place locality.
- **Weekly digest sections** still missing: streak, freshness alerts, rank changes, new followers, undiscovered places nearby — each blocked on its feature above.

## Profile ideas

Collected 2026-11-08 after the profile redesign (1.19.0); not specced yet. Suggested order: privacy → about and region → follows → reviews.

- **Privacy of bookmarks and visits.** Today anyone sees a person's bookmarks and check-ins (places and days). A setting "Show bookmarks / visits: everyone or only me".
- **"About" and home region.** One or two lines of text and a region in the card's facts line; the region later feeds "people nearby" and the regional leaderboards (feature 13).
- **Follows on the profile.** "Follow" in the card, follower / following counts, a new-follower notification. Spec: feature 12.
- **The person's reviews.** Their comments on places gathered in one place: a fifth set of "Места" or a block on the overview.
- **Share a profile** like the place page's "Поделиться", and an `og:image` of the profile (avatar, name, level, numbers) instead of their photos.
- **The author's best places.** 3–6 of their places with the highest rating or views on the overview.
- **In common with you.** On someone else's profile: "you have both been to 4 places", "12 of their places you have not seen yet" (visits and `notVisited` are there).
- **First steps for a new owner.** A checklist with the experience for each step (profile photo, first place, first check-in, first rating), gone once done.
- **Streak in the card.** The run of days and the record next to the level. Spec: feature 03.
- **Kudos on the profile** after follows: "Most thanked for photos". Spec: feature 07.
- **Report / hide a user** in a "⋯" menu of the profile, before follows and reviews make it needed.

## Metrics

D1 and D7 retention, 30-day active rate, sessions per active user per week, streak distribution.
