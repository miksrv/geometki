# Feature: Trending Places & Personalized Recommendations

## Overview

Replace the static "last updated" default ordering on the homepage and `/places` page with a dynamic, signal-driven discovery experience. The homepage gains a **"Top Places of the Week"** section powered by time-windowed view counts. The `/places` listing gains a **Trending** default sort (anonymous users) and a **Recommended** sort (authenticated users), computed from a weighted engagement score and a lightweight interest-affinity model respectively. All existing filter and sort controls are preserved.

---

## Problem / Current State

| Page | Current Default Sort | Result |
|------|---------------------|--------|
| Homepage (`/`) | `updated_at DESC` (limit 6) | Same 6 places shown for weeks; no discovery incentive |
| All Places (`/places`) | `updated_at DESC` (limit 21, paginated) | Users always land on the same stale page-1 |

`updated_at` is bumped when a place's *content* is edited. In a mature dataset edits are rare, so these lists become frozen, reducing return-visitor engagement.

The database already records `views` (total lifetime counter), `rating`, `bookmarks`, and `comments` as denormalized counters on `places`. The missing ingredient is **time-windowed view data** and a **composite engagement score** that balances freshness with quality.

---

## Proposed Solution

Three incremental phases, each independently shippable:

| Phase | Scope | Effort | Impact |
|-------|-------|--------|--------|
| 1 | Time-windowed view tracking + Homepage "Top of the Week" | Low | High |
| 2 | Trending sort for `/places` (anonymous-safe) | Low–Medium | High |
| 3 | Personalized "Recommended" sort for authenticated users | Medium | High |

---

## Phase 1 — Weekly View Tracking & Homepage "Top of the Week"

### What Changes

The homepage currently loads 6 places via:
```
placesGetList({ limit: 6, sort: 'updated_at', order: 'DESC' })
```

It will instead load the **top 6 places by view count in the last 7 days** using a new `sort=views_week` parameter, displayed under the heading "Top of the Week" (i18n: `topOfTheWeek`).

### New Database Table

```sql
-- Migration: 2024-XX-XX-000000_CreatePlaceViewsLog.php
CREATE TABLE place_views_log (
    place_id   VARCHAR(15)  NOT NULL,
    view_date  DATE         NOT NULL,
    count      MEDIUMINT    UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (place_id, view_date),
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);
```

`(place_id, view_date)` is the natural primary key — one row per place per day. The `count` column is incremented atomically, keeping write contention minimal.

### Server Changes

**`Places::show($id)` — upsert into `place_views_log` on every page view:**
```php
// After the existing: $placesModel->incrementViews($id)
$db->query(
    'INSERT INTO place_views_log (place_id, view_date, count)
     VALUES (?, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE count = count + 1',
    [$id]
);
```

**`PlacesModel::list()` — add `views_week` sort option:**
```php
case 'views_week':
    $query->join(
        '(SELECT place_id, SUM(count) AS weekly_views
          FROM place_views_log
          WHERE view_date >= CURDATE() - INTERVAL 7 DAY
          GROUP BY place_id) AS pvw',
        'pvw.place_id = places.id',
        'left'
    );
    $query->orderBy('COALESCE(pvw.weekly_views, 0)', $order);
    break;
```

The `LEFT JOIN` ensures places with no recent views still appear (with `weekly_views = 0`), which is important for the full `/places` listing but not for the homepage widget (where we only want places that have views).

**`Places::list()` — expose new sort field:**
Add `'views_week'` to the allowlist of valid `sort` parameter values alongside the existing `views|rating|comments|bookmarks|category|distance|created_at|updated_at`.

### Client Changes

**`client/api/types/index.ts`:**
```typescript
const SortFields = {
  // ... existing ...
  ViewsWeek: 'views_week',   // NEW
} as const
```

**`client/pages/index.tsx` — `getServerSideProps`:**
```typescript
// Replace existing placesGetList call
await store.dispatch(
  placesGetList.initiate({
    limit: 6,
    sort: 'views_week',
    order: 'DESC'
  })
)
```

**Homepage heading and carousel label:**
- Current: uses a generic header
- New: Section heading `t('topOfTheWeek')` with a small calendar/flame icon
- Subheading: `t('topOfTheWeekDescription')` — "Most visited places in the last 7 days"

**i18n additions** (`public/locales/*/common.json`):
```json
{
  "topOfTheWeek": "Top of the Week",
  "topOfTheWeekDescription": "Most visited places in the last 7 days"
}
```

---

## Phase 2 — Trending Sort for `/places`

### What Changes

The `/places` page default sort changes from `updated_at` to a new `trending` sort. The trending score is a **pre-computed weighted composite** stored on the `places` table, updated on a schedule. Existing filter controls and the sort dropdown remain fully functional; `trending` is simply added as a new option and promoted to default.

### Trending Score Formula

```
trending_score = round(
    (views_7d  * 1.0)   -- recent attention
  + (views_30d * 0.2)   -- broader momentum
  + (rating    * 20)    -- quality gate
  + (bookmarks * 5)     -- intent signal
  + (comments  * 3)     -- discussion signal
  + (photos    * 2),    -- content richness
  2
)
```

**Design rationale:**
- `views_7d` and `views_30d` are derived from `place_views_log` (Phase 1 prerequisite).
- The `rating` multiplier (×20) gives highly-rated places a meaningful boost without letting viral but low-quality places dominate.
- `bookmarks` carry the highest per-unit weight because a bookmark is an explicit intent signal (stronger than a passive view).
- All weights are integers to allow easy tuning without a code deploy — store them in a `config` table or `app/Config/Recommendations.php`.

**Score is normalized to a 0–10,000 integer** (`trending_score MEDIUMINT UNSIGNED`), refreshed on a schedule.

### New Database Column

```sql
-- Add to places table via new migration
ALTER TABLE places
    ADD COLUMN trending_score MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
    ADD INDEX idx_trending_score (trending_score);
```

### Scheduled Refresh (Spark Command)

```php
// app/Commands/RefreshTrendingScores.php
// Schedule: every 6 hours via cron  0 */6 * * *
// php spark trending:refresh

$db->query("
    UPDATE places p
    LEFT JOIN (
        SELECT place_id,
               SUM(CASE WHEN view_date >= CURDATE() - INTERVAL 7 DAY THEN count ELSE 0 END)  AS v7,
               SUM(CASE WHEN view_date >= CURDATE() - INTERVAL 30 DAY THEN count ELSE 0 END) AS v30
        FROM place_views_log
        GROUP BY place_id
    ) pvw ON pvw.place_id = p.id
    SET p.trending_score = ROUND(
        COALESCE(pvw.v7,  0) * 1.0
      + COALESCE(pvw.v30, 0) * 0.2
      + p.rating    * 20
      + p.bookmarks * 5
      + p.comments  * 3
      + p.photos    * 2,
        0
    )
    WHERE p.deleted_at IS NULL
");
```

Running in bulk via a single UPDATE is more efficient than per-place recalculation and avoids N+1 queries.

### Server Changes

**`PlacesModel::list()` — `trending` sort:**
```php
case 'trending':
    $query->orderBy('places.trending_score', $order);
    break;
```

No join needed — score is already on the `places` row.

**`Places::list()` — update allowlist:** Add `'trending'` to valid sort values.

### Client Changes

**`client/api/types/index.ts`:**
```typescript
const SortFields = {
  // ... existing ...
  Trending: 'trending',   // NEW
} as const
```

**`client/pages/places.tsx`:**
```typescript
// Change the default sort fallback
const sort = (query.sort as SortFieldsType) ?? SortFields.Trending
```

**`sections/places-filter-panel/` — sort dropdown:**
Add `trending` option with a label `t('sortTrending')` ("Trending"). Place it first in the dropdown list so it reads:
1. Trending *(new default)*
2. Views
3. Rating
4. Bookmarks
5. Comments
6. Distance
7. Date added
8. Last updated

**i18n additions:**
```json
{
  "sortTrending": "Trending"
}
```

---

## Phase 3 — Personalized Recommendations for Authenticated Users

### Concept

When a logged-in user visits `/places`, the default sort switches from `trending` to `recommended`. The recommendation model is **content-based filtering** on category and tag affinity: it scores each place by how well its category and tags match the user's established interests, then blends this affinity score with the trending score to ensure variety.

This is intentionally lightweight — no matrix factorization, no embeddings, no ML infrastructure. The signal set is:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Bookmarked place's category | 3.0 | Explicit save = strong interest |
| Visited place's category | 2.0 | Physical visit = confirmed interest |
| Rated ≥4 place's category | 2.5 | Positive rating = quality match |
| Viewed place's category | 1.0 | Passive view = weak signal |
| Tag match (any above) | ×1.5 multiplier | Tags refine within a category |

### New Database Table

```sql
-- Migration: 2024-XX-XX-000001_CreateUserInterestProfiles.php
CREATE TABLE user_interest_profiles (
    user_id       VARCHAR(15)  NOT NULL,
    category      VARCHAR(50)  NOT NULL,
    affinity      FLOAT        NOT NULL DEFAULT 0,
    updated_at    DATETIME     NOT NULL,
    PRIMARY KEY (user_id, category),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

One row per (user, category) pair. `affinity` is the sum of all weighted signals for that category, normalized to [0, 1] across the user's full profile.

### Interest Profile Refresh

Rebuilt by a Spark command (hourly, for active users only):

```php
// app/Commands/RefreshUserInterestProfiles.php
// php spark interests:refresh [--user=<id>]
//
// Signal aggregation per user:
//   Bookmarks:        weight 3.0
//   Visited places:   weight 2.0
//   Ratings ≥ 4:      weight 2.5
//   Activity (views): weight 1.0
//
// Normalize per user so the top category = 1.0, others are fractions.
```

Also triggered immediately (async via a queued job or fire-and-forget request) whenever the user:
- Bookmarks a place
- Marks a place as visited
- Submits a rating ≥ 4

### Recommendation Score (Server-Side, Per Request)

When `sort=recommended` is requested with a valid JWT:

```php
// app/Controllers/Places.php :: list()
if ($sort === 'recommended' && $this->authUser) {
    $userId = $this->authUser->id;
    // join user_interest_profiles and place_views_log
    // score = (affinity_score * 0.6) + (trending_score_normalized * 0.4)
    // exclude places already visited by this user (optional, toggleable)
    $query->join(
        '(SELECT p2.id,
                 COALESCE(uip.affinity, 0) * 0.6
               + (p2.trending_score / NULLIF((SELECT MAX(trending_score) FROM places), 0)) * 0.4
               AS rec_score
          FROM places p2
          LEFT JOIN user_interest_profiles uip
               ON uip.user_id = ? AND uip.category = p2.category
         ) AS rec',
        'rec.id = places.id',
        'inner'
    );
    $query->orderBy('rec.rec_score', 'DESC');
}
```

The 60/40 affinity-to-trending blend ensures:
- Users with strong category preferences see relevant places first.
- Users with sparse history (new accounts) still get a sensible list (trending dominates).
- Popular places with low affinity still surface, preventing filter bubbles.

**Cold start (no interaction history):** Fall through to `trending` sort. No separate code path needed — `affinity` will be `NULL` / 0 for all categories, so the trending component (×0.4 normalized) provides the ranking.

### Client Changes

**`client/pages/places.tsx`:**
```typescript
import { useSelector } from 'react-redux'
import { selectIsLoggedIn } from '@/app/authSlice'

// In getServerSideProps (server-side rendering, no auth context available):
// Always use 'trending' for SSR; hydrate client-side sort preference.

// In the component:
const isLoggedIn = useSelector(selectIsLoggedIn)
const defaultSort = isLoggedIn ? SortFields.Recommended : SortFields.Trending
const [sort, setSort] = useState<SortFieldsType>(
  (router.query.sort as SortFieldsType) ?? defaultSort
)
```

Because SSR doesn't have user auth context (JWT is not forwarded to the internal API during SSR), the server always renders with `trending`. On client hydration, if the user is authenticated and no explicit `?sort=` is in the URL, the page silently switches to `recommended`. This avoids a layout shift because the initial SSR HTML and the first client render both show the `trending` list (same content, just re-sorted on the next data fetch).

**`sections/places-filter-panel/` — sort dropdown:**
Add `recommended` as the first option, visible only when authenticated:

```
1. Recommended  ← auth-only, shown first when logged in
2. Trending     ← default for anonymous
3. Views
...
```

**i18n additions:**
```json
{
  "sortRecommended": "Recommended",
  "sortRecommendedTooltip": "Places tailored to your interests"
}
```

**New API type:**
```typescript
const SortFields = {
  // ... existing ...
  Recommended: 'recommended',   // NEW
} as const
```

---

## Full Server API Summary

### Updated `GET /places` sort parameter values

| Value | Description | Auth Required |
|-------|-------------|--------------|
| `updated_at` | Last content edit (existing default) | No |
| `created_at` | Creation date | No |
| `views` | Total lifetime views | No |
| `views_week` | Views in the last 7 days | No |
| `rating` | Average user rating | No |
| `bookmarks` | Bookmark count | No |
| `comments` | Comment count | No |
| `distance` | Distance from lat/lon | No (needs lat/lon) |
| `category` | Category name | No |
| `trending` | Weighted engagement score | No (**new default**) |
| `recommended` | Interest-affinity blend | Yes (falls back to trending) |

---

## Database Migrations

Three new migrations, in dependency order:

```
2024-XX-XX-000000_CreatePlaceViewsLog.php        (Phase 1)
2024-XX-XX-000001_AddTrendingScoreToPlaces.php   (Phase 2)
2024-XX-XX-000002_CreateUserInterestProfiles.php  (Phase 3)
```

No existing migrations are modified. No existing columns are removed or renamed.

---

## Spark Commands

| Command | Schedule | Phase |
|---------|----------|-------|
| `php spark trending:refresh` | `0 */6 * * *` (every 6 h) | 2 |
| `php spark interests:refresh` | `0 * * * *` (hourly, active users) | 3 |
| `php spark interests:refresh --user=<id>` | On-demand / event-triggered | 3 |

Both commands are safe to run multiple times (idempotent UPDATE/REPLACE logic).

---

## Rollout Plan

**Phase 1** can be merged and deployed independently in a single PR. The `place_views_log` table starts empty; the homepage will show `views_week = 0` for all places initially and surface recently-viewed ones within hours. There is no risk of surfacing bad data.

**Phase 2** requires Phase 1 to be running for at least 7 days before the `trending_score` values are meaningful. A feature flag (`NEXT_PUBLIC_ENABLE_TRENDING_SORT=true`) can gate the frontend change while the data accumulates. Until the flag is enabled, the server already accepts `sort=trending` (returning `trending_score`-ordered results, which are all 0 initially and fall back to natural table order). Alternatively, the first scheduled `trending:refresh` run can be seeded with 30-day historical data from `place_views_log` on day one.

**Phase 3** can be merged at any time after Phase 1 but should not be set as the default until Phase 2 has been live for a few days and trending scores are populated (the 40% trending blend in the recommendation score depends on it).

---

## Why It Fits

- **No new infrastructure.** Everything runs on the existing MySQL + CodeIgniter stack. No Redis, no ML service, no separate recommendation microservice.
- **Additive, not breaking.** All existing sort options remain. Users who bookmarked `/places?sort=updated_at` will keep seeing the same results. The only breaking change is the default sort for users who arrive with no query string — and that is the explicit goal.
- **Builds on existing data.** `rating`, `bookmarks`, `comments`, `photos`, `users_visited_places`, `users_bookmarks`, and `rating` are all already populated. The only new data collection is the `place_views_log` daily counter.
- **Scales with the dataset.** The trending score is pre-computed; page-1 of `/places` is a single indexed scan on `trending_score DESC`. The recommendation query adds one join but is bounded by the user's profile size (at most one row per category, which is O(10)).
- **Synergizes with Feature 05** (Place Quality Score). The `quality_score` field from that feature can be added as an additional signal in the trending formula (`quality_score * 0.5`) without any structural changes to Phase 2.
