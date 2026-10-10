# Feature: Territory Ownership (Regional Champions)

> **Status: not started.** Overlaps with [13 — Regional Leaderboards](./13-regional-leaderboards.md): champions are the #1 of a leaderboard; build them on the same scoring.

## Overview

Users compete to be the top contributor in a geographic area. The leader earns the "Champion of {area}" title and a passive XP bonus while holding it.

## Areas

No new `regions` table: places are already geocoded into `location_countries`, `location_regions`, `location_localities`, `location_districts` (see `server/app/Libraries/LocationMatcher.php`). Champions are computed per locality and per region.

**Table `location_champions`**
```sql
location_type, location_id, user_id, score, since_date, updated_at
-- score = places×3 + photos×1 + edits×2
```

## Champion Calculation

A daily Spark command:
1. Aggregates `activity` by `(user_id, location)` joined to `places`.
2. Picks the top score per area.
3. On change, notifies the old champion ("You've been overtaken in Kazan") and the new one.

## Champion Privileges

| Benefit | Detail |
|---------|--------|
| Title badge | "Champion of {City}" on the profile |
| Passive XP | +5 XP/day while holding the title (cron) |
| Highlight | Champions visually distinguished in user lists |
| First-mover | The first contributor in an area earns a one-time badge |

## API

- `GET /locations/{type}/{id}/champions` — current champion + top 10.
- `GET /users/{id}/territories` — areas where the user is in the top 10.

## Client

- Champion section on the location landing pages (`/places/{location}`, behind `NEXT_PUBLIC_LANDING_LOCATIONS`).
- Row of champion badges on the user profile.
- Optional map layer coloring areas by how contested they are.
