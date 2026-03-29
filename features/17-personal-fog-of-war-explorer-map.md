# Feature: Personal Fog of War & Explorer Map

## Overview

Each authenticated user sees their own exploration map — the world starts covered in "fog" and clears as they physically move through areas. The cleared territory is derived from their `sessions_history` coordinates and is **visible only to them**. Separately, an aggregated (k-anonymous) community heatmap shows which areas are explored by the community as a whole — but never reveals individual movements. On the profile, users see personal exploration statistics: unique neighborhoods visited, total distance covered, cities explored.

**Effort:** Medium–High (5–7 days backend + 6–8 days frontend)
**Impact:** Very High — the fog of war mechanic is one of the highest-retention features in location apps (Fog of World has 4M+ users on this mechanic alone); creates a reason to physically move and return
**Phase:** 2

---

## Core Problem It Solves

Session coordinates exist but are used only for the existing passive visitor heatmap. The data has enormous untapped potential to create a **personal, visceral motivation to explore**. Users who see a map of the world with 80% still in fog have an immediate, geographic, personal mission: uncover it. Every walk, every commute, every trip becomes a reason to open Geometki. This is the mechanic behind Fog of World, Wandrer, and CityStrides — all products built almost entirely on this single loop.

---

## Privacy Architecture (Read This First)

This feature handles sensitive movement data. Every design decision is constrained by the following rules:

### Rule 1 — Personal fog is 100% private
The fog of war layer is computed server-side but **rendered only for the authenticated user who owns the data**. No endpoint exposes another user's movement history, cleared tiles, or path. Not even admins see individual user routes in the UI.

### Rule 2 — Community features use k-anonymous aggregation
Any social/community visualization (heatmap, popular corridors, area popularity) only renders data for a geographic cell if **at least 10 distinct users** have been in that cell. Cells with fewer than 10 users show zero signal. This prevents reverse-engineering individual movements even from aggregate data.

### Rule 3 — Grid resolution caps re-identification risk
Personal fog tiles are 100m × 100m cells — precise enough to feel personal, coarse enough that the tile does not reveal a specific address or building. Community features use a minimum 500m × 500m grid.

### Rule 4 — No real-time community data
Community heatmap data is updated every 24 hours, not in real-time. This prevents an observer from correlating a visible heatmap change with a known individual's movement.

### Rule 5 — Users control their data
- Users can view their full exploration history (list of areas cleared, by date range).
- Users can delete their exploration history (all `sessions_history` rows for their sessions).
- Users can opt out of location tracking entirely — the `PUT /location/` endpoint accepts a `consent=false` flag that stops writing to `sessions_history`.
- Deletion is immediate and irreversible. Fog resets to "all covered" after deletion.

### Rule 6 — "First Explorer" never reveals timing
The "First Explorer" badge (see below) tells the winner "you were first" — but never tells anyone else *when* the first visit occurred or *who* it was. The badge is visible on the place, but the mechanism that awarded it (the specific user's GPS trail) remains invisible.

---

## Part 1: Personal Fog of War

### Concept

The map has two layers:
1. **The base map** — the normal tile map (OpenStreetMap, Mapbox, etc.)
2. **The fog layer** — a semi-transparent dark overlay covering the entire map

As the user moves and their `sessions_history` fills in, circular "cleared" areas appear in the fog, revealing the base map underneath. Each `sessions_history` point creates a cleared radius of **~150 meters** around it. Overlapping cleared areas merge into organic exploration shapes.

This is rendered as an **inverted polygon**: one large polygon covering the entire world, with holes punched out for each cleared cell cluster. Leaflet supports this natively via the holes array in a Polygon layer.

### Tile Grid System

Rather than working with raw GPS points (which would require expensive polygon operations on the frontend), the server converts `sessions_history` coordinates into a discrete tile grid using the [Slippy Map tile system](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames) at zoom level 14 (tiles are ~2.4 km wide at the equator, but for personal tiles we use a finer subdivision).

**Personal tiles use zoom level 16:** each tile is ~600m × ~600m at mid-latitudes. A single `sessions_history` point "unlocks" the tile it falls in plus 8 neighboring tiles — creating approximately the 150m cleared radius effect.

### New Table: `user_explored_tiles`

```sql
CREATE TABLE user_explored_tiles (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    tile_z     TINYINT UNSIGNED NOT NULL DEFAULT 16,
    tile_x     INT UNSIGNED NOT NULL,
    tile_y     INT UNSIGNED NOT NULL,
    first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_tile (user_id, tile_z, tile_x, tile_y),
    KEY idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

The `first_seen` timestamp is stored for the "First Explorer" mechanic only. It is never exposed via any public API endpoint.

### Tile Computation Cron

A nightly job (or triggered on `sessions_history` insert via a background queue) processes new `sessions_history` entries and populates `user_explored_tiles`:

```php
// For each new sessions_history row:
// 1. Convert lat/lon to tile (z=16, x, y) using standard tile math
// 2. Compute 8 neighboring tiles (Moore neighborhood)
// 3. UPSERT all 9 tiles into user_explored_tiles (IGNORE if already exists — preserves first_seen)
```

**Tile math (standard):**
```php
function latLonToTile(float $lat, float $lon, int $zoom): array {
    $x = (int) floor(($lon + 180) / 360 * (1 << $zoom));
    $y = (int) floor((1 - log(tan(deg2rad($lat)) + 1 / cos(deg2rad($lat))) / M_PI) / 2 * (1 << $zoom));
    return ['x' => $x, 'y' => $y];
}
```

### API: Personal Fog Data

**`GET /users/me/fog`**

Query params:
- `bbox` — bounding box of the visible map: `south,west,north,east`
- `z` — tile zoom level (client requests only tiles in the current viewport)

Response:
```json
{
  "tiles": [
    { "x": 39201, "y": 20451 },
    { "x": 39202, "y": 20451 }
  ],
  "total_tiles": 847,
  "zoom": 16
}
```

The client renders the fog as a full-world polygon with holes at each returned tile's bounds. This endpoint is authenticated and only ever returns data for the requesting user. Response is cached with a 1-hour TTL per user (fog doesn't change minute-to-minute).

---

## Part 2: Explorer Statistics

### Personal Stats

Computed from `user_explored_tiles` and stored as denormalized columns on the `users` table for fast profile rendering:

```sql
ALTER TABLE users
    ADD COLUMN explored_tiles_count   INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN explored_cities_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN explored_km_estimate   DECIMAL(8,1) NOT NULL DEFAULT 0.0;
```

**`explored_km_estimate`** is derived from tile count: at zoom 16, each tile is roughly 600m × 600m ≈ 0.36 km². Total km of "explored paths" is approximated as `tile_count × 0.3 km` (accounting for overlap and the non-linear nature of movement). This is a fun approximation, not a precise GPS track measurement.

**`explored_cities_count`** is derived by reverse-geocoding tile centroids into city-level Nominatim responses (already available in the stack) and counting distinct city names. Updated weekly.

### Stats API

**`GET /users/me/stats/exploration`**

```json
{
  "tiles_total": 847,
  "tiles_this_month": 34,
  "km_estimate": 254.1,
  "cities_count": 7,
  "neighborhoods_count": 23,
  "first_exploration": "2024-08-12T11:30:00Z",
  "most_active_city": "Москва",
  "exploration_score": 2840
}
```

**`exploration_score`** is derived from tile count and feeds into the Regional Leaderboard (Feature 13) as a bonus component: `leaderboard_score += exploration_score * 0.1`.

### Profile Display

On the user profile page, below the existing stats row:

```
🗺️ Exploration
─────────────────────────────────────
847 tiles  ·  ~254 km explored  ·  7 cities
[View my exploration map →]
```

The "View my exploration map" link opens a dedicated page (`/users/me/map`) showing their personal fog overlay centered on their most-explored area.

---

## Part 3: Community Heatmap (Enhanced)

The existing heatmap already uses session coordinates. This feature enhances it using `sessions_history` movement data, while strictly enforcing k-anonymity.

### New Table: `heatmap_grid_cache`

```sql
CREATE TABLE heatmap_grid_cache (
    cell_x        INT NOT NULL,
    cell_y        INT NOT NULL,
    cell_zoom     TINYINT UNSIGNED NOT NULL DEFAULT 11,  -- ~150m cells
    user_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    visit_count   INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at    DATETIME NOT NULL,
    PRIMARY KEY (cell_x, cell_y, cell_zoom)
);
```

**Nightly aggregation cron:**
```sql
-- Aggregate sessions_history into grid cells
INSERT INTO heatmap_grid_cache (cell_x, cell_y, cell_zoom, user_count, visit_count, updated_at)
SELECT
    FLOOR(lon / 0.005) AS cell_x,   -- ~500m grid at mid-latitudes
    FLOOR(lat / 0.005) AS cell_y,
    11                 AS cell_zoom,
    COUNT(DISTINCT s.user_id) AS user_count,
    COUNT(*)           AS visit_count,
    NOW()
FROM sessions_history sh
JOIN sessions s ON sh.session_id = s.id
WHERE s.user_id IS NOT NULL   -- only authenticated users
GROUP BY cell_x, cell_y
HAVING user_count >= 10       -- k-anonymity: suppress cells with < 10 distinct users
ON DUPLICATE KEY UPDATE
    user_count  = VALUES(user_count),
    visit_count = VALUES(visit_count),
    updated_at  = VALUES(updated_at);
```

**`GET /heatmap`** — existing endpoint, refactored to query `heatmap_grid_cache` instead of raw `sessions`. Much faster (one table with pre-aggregated cells, ~10× fewer rows). Only returns cells where `user_count >= 10`.

---

## Part 4: "First Explorer" Badge

### Concept

When a user's `sessions_history` point falls within 300 meters of a place that has never had a `first_explorer_user_id`, that user earns the "First Explorer" badge for that place. This converts passive location data into an active achievement mechanic.

### Schema Change

```sql
ALTER TABLE places
    ADD COLUMN first_explorer_user_id INT UNSIGNED NULL,
    ADD COLUMN first_explored_at      DATETIME NULL,
    ADD FOREIGN KEY (first_explorer_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### Processing Logic

The nightly tile cron also checks:

```php
// For each new sessions_history point:
// 1. Find places within 300m of this point WHERE first_explorer_user_id IS NULL
// 2. For each such place:
//    a. Set places.first_explorer_user_id = user_id
//    b. Set places.first_explored_at = NOW()
//    c. Award +25 XP to user
//    d. Trigger achievement check: "First Explorer" badge (if not already earned)
//    e. Push notification: "You were the first explorer to physically reach [Place Name]!"
```

**Privacy:** `first_explorer_user_id` is a foreign key in the DB but the API response for a place shows only a boolean `"you_are_first_explorer": true` to the place creator/first explorer themselves. The public place page shows "✓ First visited" without revealing whose GPS triggered it.

### Place Detail Page

If the authenticated user is the first explorer for this place:

```
📍 Кофейня «Пушкин»
────────────────────
🥇 You were the first explorer to physically reach this place.
```

This label is visible only to the first explorer — not to other users browsing the place.

---

## Part 5: Personal Exploration History Page (`/users/me/map`)

A dedicated page with two tabs:

### Tab 1: Exploration Map

Full-screen map with the user's fog overlay. Controls:
- **"My fog"** toggle — show/hide the personal fog layer
- **Time filter** — "All time / This year / This month / Custom" — fog shows only tiles cleared in the selected period (derived from `user_explored_tiles.first_seen`)
- **Stats sidebar** — tiles cleared, km estimated, cities explored (rendered from the stats endpoint)

This is the most visually impressive part of the feature. A user who has been active for 6 months will see an organic, personalized map of their life — commute corridors, vacation routes, neighborhood walks, all rendered as cleared land against a dark fog. It's deeply personal and highly shareable.

### Tab 2: Exploration Timeline

A timeline of "exploration milestones":
- First ever tile cleared (first time location was recorded)
- First exploration in a new city
- 100th / 500th / 1000th unique tile
- Largest single-day exploration (most tiles cleared in one day)

This is computed from `user_explored_tiles.first_seen` grouped by day/city.

---

## Client Design

### Map Integration (`InteractiveMap`)

The fog layer is added as an optional overlay in the existing Leaflet map. It must be **dynamically imported** (same pattern as the existing heatmap — `next/dynamic` with `ssr: false`):

```typescript
// FogOfWarLayer.tsx
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface FogTile { x: number; y: number; }

const FogOfWarLayer: React.FC<{ tiles: FogTile[]; zoom: number }> = ({ tiles, zoom }) => {
    const map = useMap();

    useEffect(() => {
        // Build world polygon with holes for each cleared tile
        const worldBounds: L.LatLngTuple[] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
        const holes: L.LatLngTuple[][] = tiles.map(tile => tileToLatLngBounds(tile, zoom));

        const fogPolygon = L.polygon([worldBounds, ...holes], {
            color: 'transparent',
            fillColor: '#1a1a2e',
            fillOpacity: 0.65,
            interactive: false,   // fog is decorative, not clickable
        }).addTo(map);

        return () => { fogPolygon.remove(); };
    }, [tiles, map]);

    return null;
};
```

The fog layer is only fetched and rendered when:
1. User is authenticated
2. User has opted into location tracking
3. The `/users/me/fog` response returns at least 1 tile

### Toggle in Map Controls

In the existing layer switcher control, add a new toggle:

```
🗺️  My Fog of War      [ ON | OFF ]
```

State persisted in `localStorage`. Disabled by default for new users (don't show an empty fog before they've moved anywhere).

### RTK Query

```typescript
getFogTiles: builder.query<FogResponse, BoundingBox>({
    query: (bbox) => `/users/me/fog?bbox=${bbox.south},${bbox.west},${bbox.north},${bbox.east}&z=16`,
    providesTags: ['FogOfWar'],
    // Long cache: fog changes slowly
    keepUnusedDataFor: 3600,
}),
getExplorationStats: builder.query<ExplorationStats, void>({
    query: () => `/users/me/stats/exploration`,
    providesTags: ['ExplorationStats'],
}),
```

---

## Data Retention & User Controls

### Settings Page: Location Data Section

```
📍 Location Data

Your movement history is used to power your personal Fog of War map
and exploration statistics. This data is never shared with other users.

  ✓ Record my location history     [Toggle]

  Exploration history: 847 tiles · since Aug 2024
  [View my exploration map]  [Delete all location history]

  ─────────────────────────────────────────────────
  ⚠️  Deleting location history is permanent and will
  reset your Fog of War map. Your exploration statistics
  and First Explorer badges will also be removed.
  [Delete all location data →]  ← requires confirmation modal
```

### Deletion Flow

`DELETE /users/me/location-history`

```php
// 1. Delete all user_explored_tiles for this user
// 2. Delete all sessions_history rows for sessions with this user_id
// 3. Set sessions.lat = NULL, sessions.lon = NULL for user's sessions
// 4. Reset users.explored_tiles_count = 0, explored_cities_count = 0, explored_km_estimate = 0
// 5. Remove first_explorer_user_id from places where first_explorer_user_id = user_id
//    (set to NULL — the place loses its first explorer record, not reassigned)
// 6. Revoke any "First Explorer" achievements (soft-delete in user_achievements)
```

---

## Achievement Integration (Feature 01)

New achievements derived from exploration data:

| Achievement | Condition | Badge |
|-------------|-----------|-------|
| First Steps | Clear first 10 tiles | 👣 |
| Explorer | Clear 100 unique tiles | 🗺️ |
| Wanderer | Clear 500 unique tiles | 🧭 |
| Pathfinder | Clear 1,000 unique tiles | 🌍 |
| Globetrotter | Explore in 5 different cities | ✈️ |
| First Explorer | Be first to physically reach any place | 🥇 |
| Pioneer | Be first explorer for 10 places | 🏆 |
| Night Owl | Clear 50 tiles between 22:00 and 05:00 (derived from first_seen timestamp) | 🌙 |

---

## Implementation Order

1. **Backend:** `user_explored_tiles` table + nightly tile computation cron from `sessions_history`
2. **Backend:** `GET /users/me/fog` endpoint (authenticated, bbox-filtered)
3. **Frontend:** `FogOfWarLayer` Leaflet component + layer switcher toggle
4. **Backend:** Explorer stats columns + `GET /users/me/stats/exploration`
5. **Frontend:** Profile stats row + `/users/me/map` page
6. **Backend:** `first_explorer_user_id` on places + First Explorer badge logic
7. **Backend:** `heatmap_grid_cache` table + cron for k-anonymous community heatmap
8. **Backend:** Delete location history endpoint + settings UI

---

## Why This Works for Engagement

The fog of war mechanic is uniquely powerful because:

1. **It makes every real-world movement count.** A morning run, a commute, a walk to the shop — all of these clear fog and produce visible progress. The map becomes a diary of your physical life.

2. **The incompleteness is the motivation.** Looking at a map that's 80% fog is a stronger pull than looking at an empty rewards screen. The gaps are geographically specific — "I've never been to that neighborhood." The mission is automatic.

3. **It's asymmetric.** Early exploration is fast and rewarding (open spaces clear quickly). Later exploration requires going to new places you haven't been — naturally incentivizing travel and discovery of new parts of the city.

4. **It's non-competitive by default.** You can't compare fog maps because they're private. But it feeds into leaderboards and exploration scores, creating an opt-in competitive dimension.

5. **It synergizes with ghost places.** A map showing both your fog AND ghost place markers creates a perfect dual mission: "Go to that unexplored area to clear the fog AND capture the ghost place at the same time."
