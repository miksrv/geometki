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
- **Regional territory / district champions.** Daily score per district (places ×3 + photos ×1 + edits ×2), champion badge, notification on being overtaken. Spec: features 04, 13.
- **Place quality score and curator rank.** Quality tiers on place cards, passive XP for authors of featured places, curator rank by average quality. Spec: feature 05.
- **Freshness badges with decay.** Stub / Draft / Complete / Verified / Exemplary, degrading without updates; "your place dropped a tier" notification and a "needs attention" list. Spec: feature 15.
- **Seasonal events and community goals.** Themed 1–4 week events by category with tiered badges and a shared progress bar. Seasonal achievement windows already exist; events, banner and lifecycle do not. Spec: feature 06.
- **Follow system and personal feed.** Follow users, "Following / Global" toggle on the feed, new-follower notification, follower counts. Spec: feature 12.

## Phase 3 — only after Phases 1–2 are live

- **Social kudos** — peer endorsements ("Accurate mapper", "Local expert"), one per type per recipient per month. Spec: feature 07.
- **Photo challenges and community albums** with voting. Spec: feature 14.
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
- **Personal exploration map.** The hex layer of `/map` is live (1.18.0); still missing: one map of a person's places and visits on their page, their share of each region. Spec: feature 25, step 7.

## Quick wins

- **"Your place was viewed N times this week"** notification when a place gets 20+ views in a week (views are already logged).
- **First-session onboarding:** pin your home area → create your first place → "come back tomorrow".
- **Category completion progress** for logged-in users: "You've added 3 of 47" in the category filter or on the profile.
- **Top explorers in your city this week** on the home page, by XP earned, grouped by the place locality.
- **Weekly digest sections** still missing: streak, freshness alerts, rank changes, new followers, undiscovered places nearby — each blocked on its feature above.

## Metrics

D1 and D7 retention, 30-day active rate, sessions per active user per week, streak distribution.
