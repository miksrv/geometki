# Feature: Overpass Ghost Places & Capture Mechanic

## Overview

The site already supports `OverpassAPI.php`, `OverpassCategoryModel`, and an 80-entry category
mapping seeder — the import plumbing is mostly in place. This feature builds the full product
layer on top of it: a parallel universe of "ghost" locations sourced from OpenStreetMap that
users can explore and claim, creating a living discovery layer alongside user-generated content.

The core loop is simple: the map is pre-populated with grayed-out pins that represent real
places nobody has written about yet. Users unlock them by contributing — turning a ghost pin
into a full, authored place. Every captured place is permanently credited to whoever claimed
it first.

---

## 1. Database Design

### 1.1 `places_overpass` — the ghost place store

This is a permanent, append-only record of every OSM node ever imported. It never gets
deleted; it only changes status.

```sql
CREATE TABLE places_overpass (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    osm_id        BIGINT UNSIGNED NOT NULL,          -- OpenStreetMap node/way/relation ID
    osm_type      ENUM('node', 'way', 'relation') NOT NULL DEFAULT 'node',
    lat           DECIMAL(10,6) NOT NULL,
    lon           DECIMAL(10,6) NOT NULL,
    name          VARCHAR(250) NULL,                 -- raw OSM name tag
    name_en       VARCHAR(250) NULL,                 -- OSM name:en tag if present
    name_ru       VARCHAR(250) NULL,                 -- OSM name:ru tag if present
    category      VARCHAR(50)  NULL,                 -- mapped via overpass_category.category_map
    osm_tags      JSON         NULL,                 -- full raw OSM tags (future use)
    status        ENUM('active','captured','hidden','duplicate') NOT NULL DEFAULT 'active',
    address_en    VARCHAR(250) NULL,
    address_ru    VARCHAR(250) NULL,
    country_id    SMALLINT NULL,
    region_id     INT NULL,
    district_id   INT NULL,
    locality_id   INT NULL,
    captured_place_id VARCHAR(15) NULL,              -- FK → places.id once captured
    captured_by       VARCHAR(15) NULL,              -- FK → users.id
    captured_at       DATETIME NULL,
    hidden_by         VARCHAR(15) NULL,              -- FK → users.id (admin only)
    dedup_place_id    VARCHAR(15) NULL,              -- FK → places.id if a duplicate was found
    dedup_confidence  TINYINT UNSIGNED NULL,         -- 0–100, confidence that dedup_place_id matches
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_osm (osm_id, osm_type)
);
```

**Key design decisions:**
- `osm_id` uniqueness prevents re-importing the same node across multiple fetch runs.
- `status = 'captured'` means a user has claimed it; `captured_place_id` links to the new
  full place. The original row stays to prevent re-import.
- `status = 'hidden'` means an admin has suppressed it (spam, error, irrelevant).
- `status = 'duplicate'` means an existing user-added `places` entry was found within the
  dedup radius during import; `dedup_place_id` and `dedup_confidence` record the match.
- `osm_tags` (JSON) preserves the raw OpenStreetMap tags — website, phone, wikipedia link,
  wikidata ID, opening hours — for enriching captured places in future.

### 1.2 `overpass_fetch_log` — rate-limiting and coverage tracking

Tracks which geographic cells have been fetched, so the cron job never hammers the same
area twice within the refresh window.

```sql
CREATE TABLE overpass_fetch_log (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_key    VARCHAR(20) NOT NULL,    -- "{lat_cell}:{lon_cell}", e.g. "55.7:37.6"
    fetched_at  DATETIME NOT NULL,
    node_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- OSM nodes returned
    new_count   SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- actually inserted
    UNIQUE KEY uq_grid (grid_key)
);
```

A "grid cell" is a bounding box of fixed size (e.g., 0.2° × 0.2° ≈ 15 km radius), derived
by rounding a coordinate pair to one decimal place. The cron job skips any cell whose
`fetched_at` is within the configured refresh window (default: 30 days).

---

## 2. Deduplication Strategy

Deduplication is run **at import time** inside the CLI command, not at query time.

### Algorithm

For each incoming OSM node:
1. **OSM ID check**: If `osm_id` already exists in `places_overpass` → skip entirely.
2. **User place proximity check**: Query `places` for any row where:
   ```
   distance(osm.lat, osm.lon, place.lat, place.lon) < DEDUP_RADIUS_METERS (default: 75m)
   ```
   Use the Haversine formula in SQL (or compute in PHP for small result sets).
3. If a matching place is found:
   - Insert the Overpass row with `status = 'duplicate'`, `dedup_place_id = place.id`.
   - Set `dedup_confidence` based on distance: 75–0m → 100–60%, plus a +20% bonus if the
     OSM `name` tag is a case-insensitive substring match of the place's title.
   - These rows are invisible to users but give admins a linkage audit trail.
4. If no match is found → insert with `status = 'active'`.

### Why not delete duplicates?

Keeping them with `status = 'duplicate'` gives admins a management panel to review edge
cases (e.g., a user-added place slightly outside the radius that really is the same object).
It also means that if the user-added place is later deleted, the Overpass entry can be
restored to `active` in a single UPDATE.

---

## 3. Visual Design — Ghost Places

Ghost places must feel like real discovery opportunities, not noise. Two principles:

**Principle 1 — Presence without pollution.** They exist on the map but do not visually
compete with user-contributed places.

**Principle 2 — Clear upgrade path.** The user must immediately understand that something
can be done about a ghost place.

### 3.1 Map layer

- Ghost pins use a **monochrome, semi-transparent** marker (30–40% opacity, no category
  color, small lock icon overlay).
- Full user places keep their existing colored category markers.
- A **toggle button** in the map controls (e.g., a ghost/lock icon) shows/hides the ghost
  layer — off by default for first-time visitors, on by default for authenticated users.
- Hovering a ghost pin shows a minimal tooltip: `name | category | "Uncaptured"`.

### 3.2 Place card / list view

When a ghost place appears in a list (e.g., search results, nearby feed):
- The card uses a **gray tint + dashed border** instead of the normal card style.
- A small badge reads `"Ghost"` or `"Uncaptured"` in the top-right corner.
- No cover image: show a **category icon on a gray background** instead.
- Title is shown in italics if it comes raw from OSM (potentially not in the user's locale).
- No rating stars, no photo count, no comment count — replaced by a single CTA:
  `"Be the first to capture this place"`

### 3.3 Ghost place detail page

Route: `/places/ghost/:osmId` or use the same `/places/:id` route with an `is_ghost: true`
flag in the API response.

Content:
- Title + raw OSM name (labeled "OSM name" to set expectations).
- Coordinates shown on a small embedded map (same Leaflet component, no interactivity).
- Category, address (geocoded on import).
- "Rich OSM data" section (collapsed by default): website, wikipedia link, opening hours —
  sourced from `osm_tags` JSON — so even uncaptured places feel informative.
- A prominent `Capture` button (see §4).
- Note: no photos, no rating, no comments — these only exist after capture.

---

## 4. Capture Mechanic

### 4.1 Temporary web-based capture (implement now)

Since GPS proximity verification is not yet built, the first user to perform **any
meaningful contribution** to a ghost place becomes its author:

| Trigger | What the user does |
|---------|-------------------|
| **Title edit** | Opens the ghost place and saves an edited title or description |
| **Photo upload** | Uploads the first photo to a ghost place |

Both actions are already normal platform operations. The capture is a side effect.

**Capture flow (server-side):**
1. User submits an edit or photo for a ghost place ID.
2. Controller checks `places_overpass` for the corresponding record.
3. If `status = 'active'`:
   a. Create a new row in `places` with coordinates, category, geocoded address, and
      `user_id = current user`.
   b. Create a `places_content` row with the user's locale and their submitted title.
   c. Update `places_overpass`: `status = 'captured'`, `captured_place_id = newId`,
      `captured_by = userId`, `captured_at = now()`.
   d. Award capture XP via `ActivityLibrary` (see §4.3).
   e. Return the new `places.id` to the client, which redirects to the full place page.
4. If `status = 'captured'` by the time the second request arrives (race condition):
   return a `409 Conflict` with `captured_place_id` so the client redirects the user to the
   already-existing full place.

### 4.2 Future GPS-based capture (design now, build later)

The ghost place detail page shows a `Capture` button. When tapped on mobile:
1. Client requests geolocation from the browser.
2. Client sends `{ lat, lon }` to `POST /places/ghost/:id/capture`.
3. Server verifies distance ≤ CAPTURE_RADIUS_METERS (default: 200m) from the ghost's coords.
4. If within range → run capture flow (§4.1, steps a–e) with `capture_method = 'gps'`.
5. If too far → return `422` with `lang('Overpass.tooFarToCapture')` and the distance delta.

The schema already supports this: `captured_at` records when, and the OSM coordinates provide
the reference point. A `capture_method ENUM('web', 'gps')` column can be added to
`places_overpass` to distinguish the two paths for analytics.

### 4.3 XP awards for capture

Capture is harder than simply adding a place from scratch, so it earns proportionally more:

| Action | XP | Rationale |
|--------|----|----|
| Normal place creation | base MODIFIER_PLACE | User finds and adds it themselves |
| Ghost capture (web) | 2× MODIFIER_PLACE | Claiming an existing validated location |
| Ghost capture (GPS) | 3× MODIFIER_PLACE | Physical presence verified |
| First photo on a ghost | MODIFIER_PHOTO + 50% | Visually completing an empty location |

These can be introduced as new `type` values in the `activity` table or as a separate bonus
applied inside `ActivityLibrary::push()` when the context is a capture.

### 4.4 Capture achievements

| Badge | Trigger |
|-------|---------|
| Ghost Buster | Capture first ghost place |
| Explorer's Spirit | Capture 10 ghost places |
| Cartographic Pioneer | Capture 50 ghost places |
| GPS Hunter | Capture 5 ghost places via GPS proximity (future) |

These plug directly into the existing `achievements` / `users_achievements` schema.

---

## 5. Cron-Based Data Loading

### 5.1 Priority algorithm

The goal is to fetch OSM data where users actually are, not uniformly. The sessions table
already stores `lat` and `lon` for active sessions.

**Priority order:**
1. **Recent active sessions with coordinates** — sessions updated within the last 48 hours
   where `lat IS NOT NULL AND lon IS NOT NULL`, ordered by `updated_at DESC`. Take up to 30
   unique coordinate pairs.
2. **Coordinates from recently created places** — the last 20 `places.created_at` rows give
   geographic signal even without an active session.
3. **Fallback** — any grid cells that have never been fetched and that have at least one
   place in the `places` table (i.e., areas where community already exists).

### 5.2 CLI command: `overpass:fetch`

```
php spark overpass:fetch [--max-cells=10] [--radius=15] [--force]
```

**Algorithm:**
```
1. Collect up to 30 candidate (lat, lon) pairs from sessions + recent places.
2. Convert each pair to a grid key: round(lat, 1) + ":" + round(lon, 1).
3. Deduplicate grid keys.
4. Filter out keys with fetched_at < NOW() - FETCH_INTERVAL_DAYS (default: 30d), unless --force.
5. For each remaining grid key (up to --max-cells):
   a. Compute bounding box via OverpassAPI::getBoundingBox(lat, lon, --radius km).
   b. Call OverpassAPI::get(bbox) with a 30s timeout.
   c. For each OSM node returned:
      i.  Look up overpass_category by (category, name/subcategory) to get category_map.
      ii. Run dedup check against places (§2).
      iii. Geocode coordinates via Geocoder to get address/location IDs.
      iv. Insert into places_overpass or skip if osm_id already exists.
   d. Insert/update overpass_fetch_log (grid_key, fetched_at, node_count, new_count).
   e. Sleep 2 seconds between Overpass requests to respect the API fair-use policy.
6. Print summary: cells fetched, nodes returned, new places inserted, duplicates found.
```

**Cron schedule (suggested):**
```
# Every 6 hours, fetch up to 5 cells
0 */6 * * * php /var/www/spark overpass:fetch --max-cells=5 >> /var/log/overpass.log 2>&1
```

### 5.3 CLI command: `overpass:cleanup`

Maintenance command to review and prune low-quality ghost entries:
- `--hide-nameless` — set `status = 'hidden'` for all rows where `name IS NULL`.
- `--hide-category=null` — hide entries with no mapped `category_map`.
- `--stats` — print counts per status, category, country.

### 5.4 Geocoding efficiency

Geocoding every imported node is expensive (Nominatim has a 1 req/s limit). Strategy:
- Geocode only nodes that passed dedup (i.e., are genuinely new and `status = 'active'`).
- Use the bounding box coordinates to bulk-infer `country_id` and `region_id` from the
  existing `location_*` tables (which already cover most of the world) before calling
  Nominatim — this avoids a geocoding call for the common case.
- Store `address_en` / `address_ru` only for nodes that survive the quality filter
  (i.e., have a non-null `name` and a mapped category).

---

## 6. API Design

### 6.1 New endpoints

```
GET  /places/ghost                  List ghost places (with filters: category, bbox, country, etc.)
GET  /places/ghost/:id              Ghost place detail
POST /places/ghost/:id/capture      Trigger web capture (title or photo required in body)
POST /places/ghost/:id/capture/gps  GPS proximity capture (future; body: {lat, lon})
```

### 6.2 Extended existing endpoints

**`GET /poi`** — already returns clustered points for the map. Add a `ghost=1` parameter
that returns `places_overpass` rows (`status = 'active'`) alongside normal places, with an
`is_ghost: true` flag and a distinct `source: 'overpass'` field.

**`GET /places`** — add `include_ghost=1` to mix ghost places into paginated results (sorted
by distance if coords are available). Ghost entries return a reduced object shape:
```json
{
  "id": "ghost_12345678",
  "is_ghost": true,
  "lat": 55.751244,
  "lon": 37.618423,
  "title": "Памятник Пушкину",
  "category": { "name": "monument" },
  "source": "overpass",
  "osm_id": 12345678
}
```

The `ghost_` prefix in the ID allows the client to route to `/places/ghost/:osmId` instead
of `/places/:id` without a separate type flag.

### 6.3 Admin endpoints (role-gated)

```
PATCH /places/ghost/:id/hide        Set status = 'hidden'
PATCH /places/ghost/:id/restore     Set status = 'active' (undo hide or duplicate)
GET   /admin/ghost/stats            Counts per status, category, country
```

---

## 7. Integration with Existing Features

### 7.1 Territory Ownership (Feature 04)

A captured ghost place in a given region contributes to the regional leaderboard with a
higher weight than a normal place (e.g., 4 points vs. the normal 3). This makes ghost
capture a strategic move in contested regions.

### 7.2 Achievements (Feature 01)

The capture actions feed directly into the existing `achievements` evaluation logic in
`AchievementsLibrary::check()`. The new capture achievements (§4.4) require only new seed
data rows in the `achievements` table and a new trigger type in the evaluator.

### 7.3 Daily/Weekly Challenges (Feature 02)

Suggested new challenge types:
- `"Capture 1 ghost place today"` (+50 XP)
- `"Capture 3 ghost places this week"` (+200 XP)

These slot directly into the existing `ChallengesLibrary::increment()` hook in
`ActivityLibrary::push()`.

### 7.4 User Interest Profiles (existing)

When a user captures a ghost place, the category affinity for that category is updated in
`user_interest_profiles`. Ghost places captured by the user should also appear in the
recommendation engine's "places you've contributed to" exclusion list.

---

## 8. Content Quality — Handling Raw OSM Names

OSM data quality varies. A node might have `name = "ТЦ Мега"`, `name = "tree_1234"`, or
no name at all. Mitigation strategies:

| Situation | Handling |
|-----------|---------|
| No `name` tag | Use category title as placeholder: `"[Historic Site]"` (in italics) |
| `name` in unknown script | Show as-is; mark for review if no `name:en` or `name:ru` |
| `name:en` / `name:ru` available | Prefer these per user locale (already in schema) |
| After capture | User's submitted title replaces the OSM name in `places_content`; OSM name becomes a "also known as" reference stored in `osm_tags` |

The `places_overpass.osm_tags` JSON column also stores `wikipedia`, `wikidata`, `website`,
`phone`, and `opening_hours` tags. After capture, these can be surfaced in the place detail
page as "Verified external sources" without requiring the user to fill them in manually.

---

## 9. "Discover" Feed

A new lightweight API endpoint surfaces ghost places as a **discovery feed**:

```
GET /discover/ghost?lat=55.75&lon=37.62&radius=5&limit=10
```

Returns the nearest uncaptured ghost places to the given coordinates, ordered by distance,
excluding any the authenticated user has already viewed. This powers:

- A **"Nearby Uncaptured" section** on the homepage (authenticated users).
- A **push notification** sent weekly: `"There are 12 uncaptured places within 5 km of you"`.
- A **map callout** when the user is near an uncaptured place (future mobile feature).

---

## 10. Implementation Phases

### Phase 1 — Foundation (backend only, no visible UI changes)
- [ ] Migration: `places_overpass` table
- [ ] Migration: `overpass_fetch_log` table
- [ ] Update `OverpassAPI.php`: replace `file_get_contents` with Guzzle (timeout, error handling, User-Agent header)
- [ ] New `OverpassPlacesModel.php`
- [ ] CLI command `overpass:fetch` with dedup logic and geocoding
- [ ] CLI command `overpass:cleanup`
- [ ] Unit tests for dedup algorithm and bounding box math

### Phase 2 — API & web capture
- [ ] `GET /places/ghost` and `GET /places/ghost/:id` endpoints
- [ ] `POST /places/ghost/:id/capture` (web capture flow)
- [ ] Extend `GET /poi` with `ghost=1` parameter
- [ ] Admin hide/restore endpoints
- [ ] Language files: `en/Overpass.php`, `ru/Overpass.php`

### Phase 3 — Frontend
- [ ] Ghost map marker style (gray, semi-transparent, lock icon)
- [ ] Map layer toggle button ("Show uncaptured places")
- [ ] Ghost place card style (dashed border, gray tint, ghost badge)
- [ ] Ghost place detail page with Capture CTA
- [ ] Capture success animation + XP award notification
- [ ] "Nearby Uncaptured" section on homepage

### Phase 4 — Gamification hooks
- [ ] Capture achievements seeded into `achievements` table
- [ ] Capture XP multipliers in `ActivityLibrary`
- [ ] Challenge types for capture actions
- [ ] Territory Ownership weight adjustment for captured places

### Phase 5 — GPS capture (future)
- [ ] `POST /places/ghost/:id/capture/gps` endpoint with proximity check
- [ ] Mobile-first capture flow with geolocation permission request
- [ ] GPS capture badge and higher XP tier

---

## Why This Fits Geometki

Geometki's identity is as an exploration platform, not just a data entry tool. Ghost places
make the map feel *alive and incomplete in an intentional way* — the emptiness becomes the
game. A user who stumbles onto a grayed-out castle ruin near their hiking trail has an
immediate reason to stop, photograph it, and publish it. That is the core loop.

The OSM data also solves a cold-start problem: new regions of the map that have zero
user-contributed content can still show interesting locations, making the app usable and
visually compelling for users who arrive before their local community does.

The infrastructure cost is low — OverpassAPI.php, OverpassCategoryModel, and the category
seeder are already in the codebase. Phases 1 and 2 can be built with one developer in a
single sprint without touching any existing routes or models.
