# Feature 01 — Achievements & Badges

> **Status: ✅ Completed**

## Overview

A gamified achievement system that rewards users for meaningful actions on the platform. The system distinguishes between **base achievements** (always visible, permanent progress) and **seasonal achievements** (visible only during their active window, time-bounded progress). Achievements are organised into **groups** (concepts, e.g. "Explorer") with optional tier progression (Bronze → Silver → Gold). Each user holds **one medal per group** — reaching a higher tier upgrades the existing medal rather than adding a new one.

---

## Visibility Strategy

### Base Achievements
Inspired by *Ingress* medals — always listed on the achievements catalogue page, regardless of whether the user has earned them. Users can see every goal they're working toward. Progress is cumulative and never resets.

### Seasonal Achievements
Displayed **only during their active season window** (`season_start` → `season_end`). Progress counts only within that window. After the season ends:
- Earned seasonal badges remain permanently on the user's profile with a season label (e.g. *"Spring 2026"*).
- Unearned seasonal badges disappear from the catalogue.
- In-progress seasonal data is retained in the DB for admin analytics but shown nowhere on the frontend.

---

## Tier System

Each achievement group (e.g. "Explorer") can optionally have up to three tiers:

| Tier   | Color      | XP bonus on earn |
|--------|------------|-----------------|
| `none` | (neutral)  | varies          |
| Bronze | `#cd7f32`  | +10 XP          |
| Silver | `#c0c0c0`  | +25 XP          |
| Gold   | `#ffd700`  | +50 XP          |

**Single-medal upgrade model:** a user holds exactly one row in `users_achievements` per `group_slug`. When they qualify for a higher tier, the row is **updated in place** (tier upgraded, earned_at refreshed). The badge on their profile changes its image/label without adding a new medal.

Achievements with `tier = 'none'` have no tier label displayed anywhere.

---

## Category Guide

| Category | Purpose |
|---|---|
| **Exploration** | Rewards discovering and documenting places (creating geotags, visiting locations). Motivates going out and adding new POIs. |
| **Content** | Rewards enriching the quality of the platform — uploading photos, editing place descriptions, writing informative comments. Motivates improving existing data, not just adding quantity. |
| **Social** | Rewards interaction with other users' content — giving ratings, writing comments, bookmarking places. Motivates community engagement. |
| **Reputation** | Reflects platform seniority — reputation score thresholds and level milestones. Passive accumulation that recognises long-term contributors. |
| **Consistency** | Rewards habitual usage — active days and login streaks. Motivates returning to the platform regularly. |
| **Seasonal** | Time-limited badges available only during a defined season window. Creates event-driven engagement peaks. |

---

## Database Schema

### `achievements` table

```sql
CREATE TABLE achievements (
    id              VARCHAR(20)  NOT NULL PRIMARY KEY,
    slug            VARCHAR(100) NOT NULL UNIQUE,         -- e.g. 'explorer_gold'
    group_slug      VARCHAR(50)  NOT NULL,                -- groups tiers of same concept, e.g. 'explorer'
    type            ENUM('base','seasonal') NOT NULL DEFAULT 'base',
    tier            ENUM('none','bronze','silver','gold') NOT NULL DEFAULT 'none',
    category        VARCHAR(50)  NOT NULL,
    title_en        VARCHAR(150) NOT NULL,
    title_ru        VARCHAR(150) NOT NULL,
    description_en  TEXT,
    description_ru  TEXT,
    image           VARCHAR(200),                         -- uploaded PNG/SVG path
    rules           JSON NOT NULL,
    season_start    DATETIME NULL,
    season_end      DATETIME NULL,
    xp_bonus        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    sort_order      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    INDEX (group_slug)
);
```

Key design points:
- `slug` is unique per tier variant (`explorer_bronze`, `explorer_silver`, `explorer_gold`).
- `group_slug` is shared across all tiers of the same concept (`explorer`). Single-tier achievements use `group_slug = slug`.
- `image` stores the path to an uploaded PNG/SVG badge image (uploaded via `POST /achievements/:id/image`).

### `users_achievements` table

```sql
CREATE TABLE users_achievements (
    id              VARCHAR(20) NOT NULL PRIMARY KEY,
    user_id         VARCHAR(20) NOT NULL,
    achievement_id  VARCHAR(20) NOT NULL,               -- points to the current tier's achievement row
    earned_at       DATETIME NOT NULL,
    progress        JSON NOT NULL DEFAULT (JSON_OBJECT()),
    notified        TINYINT(1) NOT NULL DEFAULT 0,
    emailed         TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_user_achievement (user_id, achievement_id),
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);
```

> **Upgrade behaviour:** `awardAchievement()` checks if the user already has any achievement with the same `group_slug`. If so, it **updates** that row's `achievement_id` to the new tier. If not, it **inserts** a new row. The UNIQUE KEY on `(user_id, achievement_id)` prevents double-awarding the same tier.
>
> **Deduplication note:** If dirty data exists (multiple rows per group due to a past bug or manual seeding), `GET /users/:id/achievements` deduplicates server-side in `Achievements::userAchievements()` — it keeps only the highest-tier row per `group_slug` before returning the response. The frontend (`UserHeader`) applies the same deduplication defensively via `useMemo`.

---

## Rules Engine

The `rules` JSON column stores an array of metric conditions. **All conditions must be satisfied** (AND logic).

### Condition shape

```json
{
  "metric":   "places_created",
  "operator": ">=",
  "value":    50,
  "filter":   { "category_id": "3" }
}
```

`filter` is optional. `operator` supports `>=`, `>`, `=`.

### Supported metrics

| Metric key          | Data source                                     |
|---------------------|-------------------------------------------------|
| `places_created`    | `activity` WHERE `type = 'place'`               |
| `places_edited`     | `activity` WHERE `type = 'edit'`                |
| `places_visited`    | `users_visited_places`                          |
| `photos_uploaded`   | `photos` (non-deleted)                          |
| `ratings_given`     | `rating`                                        |
| `comments_written`  | `comments`                                      |
| `bookmarks_added`   | `users_bookmarks`                               |
| `reputation_score`  | `users.reputation` (point-in-time)              |
| `experience_total`  | `users.experience` (point-in-time)              |
| `days_active`       | COUNT(DISTINCT DATE) in `activity`              |
| `login_streak`      | consecutive days in `sessions_history`          |
| `level_reached`     | `users.level`                                   |
| `ghost_captures`    | Feature 11 (future)                             |

---

## `AchievementsLibrary.php` Design

### Tier-upgrade logic in `check()` / `evaluate()`

1. Build `earnedGroupMap`: `group_slug → { achievement_id, tier }` from the user's `users_achievements`.
2. For each active achievement, **skip only if** the user already has the same or higher tier in that group.
3. Lower-tier or unearned groups are evaluated normally.

### `awardAchievement()`

- If user already has a lower tier in the same group → **UPDATE** existing row (`achievement_id`, `earned_at`, `progress`, reset `notified=0`, `emailed=0`).
- If no existing row → **INSERT**.
- Always awards XP bonus and pushes a notification.

### Notification meta payload

```php
[
    'achievement_id'   => $achievement->id,
    'achievement_slug' => $achievement->slug,
    'group_slug'       => $achievement->group_slug,
    'tier'             => $achievement->tier,
    'title_en'         => $achievement->title_en,
    'title_ru'         => $achievement->title_ru,
    'image'            => $achievement->image,
    'xp_bonus'         => $achievement->xp_bonus,
    'is_upgrade'       => bool,
]
```

---

## API Endpoints

### Public catalogue

```
GET /achievements?category=&tier=&type=
```

Response includes `group_slug`, `image`, and other fields. Authenticated requests also include `earned_at` and `progress`.

### User achievements (profile)

```
GET /users/:id/achievements
```

Returns only earned achievements, deduplicated by `group_slug` — one entry per group, highest tier only. Used to render the badge shelf on user profiles.

### Admin CRUD (role: admin)

```
GET    /achievements/manage          — full list including inactive
POST   /achievements                 — create
GET    /achievements/:id             — single record
PUT    /achievements/:id             — update
DELETE /achievements/:id             — soft-delete if users earned it, hard-delete otherwise
POST   /achievements/:id/activate    — re-activate
POST   /achievements/:id/image       — upload PNG/SVG badge image (max 1 MB)
```

All admin endpoints enforce `role === 'admin'`, returning 403 otherwise.

---

## Frontend

### Navigation

Admin link **"Управление достижениями"** (`/admin/achievements`) is shown in `SiteMenu` (both desktop rail and mobile drawer) with:
- A horizontal divider separating it from public menu items.
- Visible only when `userRole === 'admin'`.

### Achievements on User Profile

Earned badges are displayed directly on `/users/:id` inside `UserHeader`, **below the statistics block** on the right side. Uses the existing `AchievementBadge` component. No separate tab or page is needed.

### Achievements Tab

Removed from `UserTabs`. The `/users/:id/achievements` route still exists for direct linking but is not shown in navigation.

### Admin Management UI

- **List page**: `pages/admin/achievements/index.tsx` — table with Edit (link) and Delete actions.
- **Create page**: `pages/admin/achievements/create.tsx` — dedicated full-page form.
- **Edit page**: `pages/admin/achievements/[id].tsx` — full-page form pre-populated from `GET /achievements/manage`, includes image upload input.

Both create and edit pages redirect to `/admin/achievements` on save. Auth guard: non-admin users are redirected to `/`.

### Badge Images

The edit page (`/admin/achievements/[id].tsx`) includes a file input accepting PNG and SVG (max 1 MB). On selection, the file is uploaded via `POST /achievements/:id/image`. The returned path is displayed immediately.

### Notifications

Achievement notifications (`type === 'achievements'`) display:
- **Icon**: the badge's `image` (if set) or a default `Award` icon.
- **Title**: `t('notification_achievements')` ("New achievement" / "Новое достижение").
- **Content**: localised achievement title + tier label in parentheses (omitted for `tier === 'none'`).

---

## Seed Data Catalogue

All tiered achievements share a `group_slug` (e.g. `explorer`) so tiers upgrade rather than stack.

### Exploration

| Slug | Group | Tier | Rules |
|---|---|---|---|
| `explorer_bronze` | `explorer` | Bronze | places_created >= 10 |
| `explorer_silver` | `explorer` | Silver | places_created >= 50 |
| `explorer_gold`   | `explorer` | Gold   | places_created >= 200 |
| `wanderer_bronze` | `wanderer` | Bronze | places_visited >= 25 |
| `wanderer_silver` | `wanderer` | Silver | places_visited >= 100 |
| `wanderer_gold`   | `wanderer` | Gold   | places_visited >= 500 |

### Content

| Slug | Group | Tier | Rules |
|---|---|---|---|
| `photographer_bronze` | `photographer` | Bronze | photos_uploaded >= 20 |
| `photographer_silver` | `photographer` | Silver | photos_uploaded >= 100 |
| `photographer_gold`   | `photographer` | Gold   | photos_uploaded >= 500 |
| `curator_bronze`      | `curator`      | Bronze | places_edited >= 10 |
| `curator_silver`      | `curator`      | Silver | places_edited >= 50 |
| `curator_gold`        | `curator`      | Gold   | places_edited >= 200 AND comments_written >= 50 |

### Social

| Slug | Group | Tier | Rules |
|---|---|---|---|
| `critic_bronze`    | `critic`     | Bronze | ratings_given >= 20 |
| `critic_silver`    | `critic`     | Silver | ratings_given >= 100 |
| `commenter_bronze` | `commenter`  | Bronze | comments_written >= 10 |
| `commenter_silver` | `commenter`  | Silver | comments_written >= 50 |
| `commenter_gold`   | `commenter`  | Gold   | comments_written >= 200 |
| `collector`        | `collector`  | None   | bookmarks_added >= 30 |

### Reputation

| Slug | Group | Tier | Rules |
|---|---|---|---|
| `trusted_bronze` | `trusted` | Bronze | reputation_score >= 50 |
| `trusted_silver` | `trusted` | Silver | reputation_score >= 200 |
| `trusted_gold`   | `trusted` | Gold   | reputation_score >= 1000 |
| `veteran_bronze` | `veteran` | Bronze | level_reached >= 5 |
| `veteran_silver` | `veteran` | Silver | level_reached >= 15 |
| `veteran_gold`   | `veteran` | Gold   | level_reached >= 25 |

### Consistency

| Slug | Group | Tier | Rules |
|---|---|---|---|
| `regular_bronze` | `regular` | Bronze | days_active >= 7 |
| `regular_silver` | `regular` | Silver | days_active >= 30 |
| `regular_gold`   | `regular` | Gold   | days_active >= 100 |
| `streak_bronze`  | `streak`  | Bronze | login_streak >= 7 |
| `streak_silver`  | `streak`  | Silver | login_streak >= 30 |

### Seasonal examples

| Slug | Group | Tier | Window | Rules |
|---|---|---|---|---|
| `spring_explorer_2026`     | `spring_explorer_2026`     | Silver | 2026-03-01 → 2026-05-31 | places_visited >= 10 (category 5) AND >= 10 (category 8) |
| `summer_photographer_2026` | `summer_photographer_2026` | Gold   | 2026-06-01 → 2026-08-31 | photos_uploaded >= 50 |
| `autumn_curator_2026`      | `autumn_curator_2026`      | Silver | 2026-09-01 → 2026-11-30 | places_edited >= 20 AND ratings_given >= 30 |

---

## Deployment Steps

1. Run migration: `composer run migration:run` (applies `2026-04-13-000001_RebuildAchievements`)
2. Seed data: `php spark db:seed AchievementsSeeder`
3. Initial sweep (no notifications): `php spark achievements:evaluate --all --no-notify`

---

## Notes & Future Considerations

- **Ghost place captures** (Feature 11) introduce a `ghost_captures` metric — add it to `resolveMetric()` when that feature lands.
- **No revocation:** once earned, a badge is permanent. If an admin raises a threshold, existing earners keep their current tier.
- **Progress caching:** if `getProgress()` query load becomes significant, cache per-user progress with a short TTL.
- **Multi-locale admin titles:** if more languages are added later, migrate `title_en`/`title_ru` to a `achievement_translations` table.
