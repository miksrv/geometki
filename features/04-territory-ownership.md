# Feature: Territory Ownership (Regional Champions)

## Overview

A geo-specific mechanic unique to a mapping platform: users compete to be the top contributor in a geographic region (city or administrative area). The leading contributor in a region earns the "Champion" title for that area and a passive XP bonus while they hold the title.

## How It Works

### Regions

Regions are derived from existing place data. Each place already stores coordinates and (via the Geocoder-PHP / Nominatim integration) a city/region. A materialized view or scheduled rollup computes contribution counts per user per region.

**New table: `regions`**
```sql
id, name_en, name_ru, country_code, admin_level, bbox_geojson
```

**New table: `region_champions`**
```sql
region_id, user_id, score, since_date, updated_at
-- score = weighted sum: places×3 + photos×1 + edits×2
```

### Champion Calculation

A scheduled job (daily) runs:
1. Aggregate activity by `(user_id, region)` from the `activity` table joined to `places`.
2. For each region, find the user with the highest weighted score.
3. If the champion changed, notify the old champion ("You've been overtaken in Kazan!") and the new one ("You're now the champion of Saint Petersburg!").

### Champion Privileges

| Benefit | Detail |
|---------|--------|
| Title badge | "Champion of {City}" shown on profile |
| Passive XP | +5 XP/day while holding the title (credited via cron) |
| Leaderboard highlight | Champion entries are visually distinguished on the map and user lists |
| First-mover bonus | The very first contributor in a region earns a "Pioneer" one-time badge |

### Map Integration

On the main Leaflet map, regions where the authenticated user is champion are highlighted with a colored overlay. Clicking a region shows the current champion and top-5 contributors.

### API

- `GET /regions` — list regions with current champion and user's rank in each.
- `GET /regions/{id}` — leaderboard for a specific region (top 10 contributors).
- `GET /users/{id}/regions` — all regions where user is in the top 10.

### Client

- **Map layer** (togglable): "Champion View" overlay colors regions by how contested they are (green = uncontested, red = tight competition).
- **Region leaderboard panel**: sidebar or modal triggered by clicking a region polygon.
- **Profile badge strip**: row of city champion badges on the user profile.

## Competitive Dynamics

- Small towns are easy wins for new users, creating a natural onboarding incentive to contribute locally.
- Dense cities have fierce competition, giving high-level users a long-term goal.
- Regions update daily, so the standings feel live but not spammy.

## Why It Fits

Geometki is inherently geographic — places have coordinates and are already geocoded. This feature converts that spatial data into a competition layer without changing the core contribution model. It also incentivizes covering underrepresented regions, which improves map quality organically.
