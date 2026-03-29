# Feature 01 — Achievements & Badges

## Overview

A gamified achievement system that rewards users for meaningful actions on the platform. The system distinguishes between **base achievements** (always visible, permanent progress) and **seasonal achievements** (visible only during their active window, time-bounded progress). Achievements are organized into tiers (Bronze → Silver → Gold) and thematic categories. Evaluation runs asynchronously via a cron job to avoid impacting request latency.

---

## Visibility Strategy

### Base Achievements
Inspired by *Ingress* medals — always listed on the achievements catalogue page, regardless of whether the user has earned them. Users can see every goal they're working toward. Progress is cumulative and never resets. A user who earned a Bronze badge can continue toward Silver and Gold for the same achievement concept.

### Seasonal Achievements
Displayed **only during their active season window** (`season_start` → `season_end`). Progress counts only within that window — a visit on January 3rd does not count toward a spring season that opens March 1st. After the season ends:
- Earned seasonal badges remain permanently on the user's profile with a season label (e.g. *"Spring 2026"*).
- Unearned seasonal badges disappear from the catalogue (the opportunity is gone).
- In-progress seasonal data is retained in the DB for admin analytics but shown nowhere on the frontend.

---

## Tier System

Each achievement (base or seasonal) belongs to exactly one tier:

| Tier   | Color      | XP bonus on earn |
|--------|-----------|-----------------|
| Bronze | `#cd7f32` | +10 XP          |
| Silver | `#c0c0c0` | +25 XP          |
| Gold   | `#ffd700` | +50 XP          |

A single *concept* (e.g. "Explorer") can have three separate achievement rows — one per tier — each with its own rule thresholds. Earning Bronze does not automatically unlock Silver; each tier is evaluated independently, allowing users to hold all three simultaneously once thresholds are met.

---

## Database Schema

### Migration: `achievements` table (full rewrite)

The existing table uses rigid `SMALLINT` threshold columns (`min_count_places`, `min_count_edits`, etc.) that cannot express compound rules or filter by category/tag. Replace it entirely:

```sql
CREATE TABLE achievements (
    id           VARCHAR(20)  NOT NULL PRIMARY KEY,
    slug         VARCHAR(100) NOT NULL UNIQUE,          -- machine name, e.g. 'explorer_gold'
    type         ENUM('base','seasonal') NOT NULL DEFAULT 'base',
    tier         ENUM('bronze','silver','gold') NOT NULL DEFAULT 'bronze',
    category     VARCHAR(50)  NOT NULL,                 -- 'exploration', 'social', 'content', 'consistency', 'reputation'
    title_en     VARCHAR(150) NOT NULL,
    title_ru     VARCHAR(150) NOT NULL,
    description_en TEXT,
    description_ru TEXT,
    icon         VARCHAR(100),                          -- icon name from icon set, or uploaded asset path
    rules        JSON NOT NULL,                         -- see Rules Engine section
    season_start DATETIME NULL,                         -- NULL for base achievements
    season_end   DATETIME NULL,
    xp_bonus     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    sort_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,         -- admin soft-disable
    created_at   DATETIME NOT NULL,
    updated_at   DATETIME NOT NULL
);
```

### Migration: `users_achievements` table (extended)

The existing table has only `id`, `user_id`, `achievements_id` — no earned timestamp, no progress. Replace it:

```sql
CREATE TABLE users_achievements (
    id             VARCHAR(20)  NOT NULL PRIMARY KEY,
    user_id        VARCHAR(20)  NOT NULL,
    achievement_id VARCHAR(20)  NOT NULL,
    earned_at      DATETIME NOT NULL,
    progress       JSON NOT NULL DEFAULT '{}',           -- metric snapshot at earn time
    notified       TINYINT(1) NOT NULL DEFAULT 0,        -- in-app notification sent
    emailed        TINYINT(1) NOT NULL DEFAULT 0,        -- email sent
    UNIQUE KEY uq_user_achievement (user_id, achievement_id),
    FOREIGN KEY (user_id)         REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (achievement_id)  REFERENCES achievements(id) ON DELETE CASCADE
);
```

> **Migration note:** Create a squash migration `2026-XX-XX-000001_RebuildAchievements.php` that drops and recreates both tables. The existing seeder data is minimal (3 rows, Russian-only) — replace it with the full seed catalogue below.

### Progress tracking for un-earned achievements

Progress toward unearned achievements is **not** stored in a separate table. It is computed on-the-fly by `AchievementsLibrary::getProgress()` querying existing tables (`activity`, `users_visited_places`, `ratings`, `comments`, `photos`, etc.). This avoids a write on every user action. Only once an achievement is earned does a row land in `users_achievements`.

---

## Rules Engine

The `rules` JSON column stores an array of metric conditions. **All conditions must be satisfied** (AND logic) for the achievement to be awarded.

### Condition object shape

```json
{
  "metric":   "places_created",
  "operator": ">=",
  "value":    50,
  "filter":   { "category_id": 3 }
}
```

`filter` is optional. `operator` supports `>=`, `>`, `=`.

### Supported metrics

| Metric key             | Data source                                              |
|------------------------|----------------------------------------------------------|
| `places_created`       | `activity` WHERE `type = 'place'`                        |
| `places_edited`        | `activity` WHERE `type = 'edit'`                         |
| `places_visited`       | `users_visited_places`                                   |
| `photos_uploaded`      | `photos` (non-temporary)                                 |
| `ratings_given`        | `ratings`                                                |
| `comments_written`     | `comments`                                               |
| `bookmarks_added`      | `bookmarks`                                              |
| `reputation_score`     | `users.reputation` (point-in-time, season filter ignored)|
| `experience_total`     | `users.experience` (point-in-time, season filter ignored)|
| `days_active`          | COUNT(DISTINCT DATE(created_at)) in `activity`           |
| `login_streak`         | consecutive days in `sessions_history`                   |
| `level_reached`        | `users.level`                                            |
| `ghost_captures`       | `places_overpass WHERE captured_by = userId` (Feature 11)|

### Filter object (optional)

Restricts the metric count to a subset:
- `category_id` — filter by place category
- `tag_id` — filter to places with a given tag

### Example rules JSON

```json
// Bronze Explorer: create 10 geotags
[{ "metric": "places_created", "operator": ">=", "value": 10 }]

// Gold Curator (compound): edit 100 places AND write 50 comments
[
  { "metric": "places_edited",    "operator": ">=", "value": 100 },
  { "metric": "comments_written", "operator": ">=", "value": 50  }
]

// Seasonal spring achievement: visit 10 monuments AND 10 abandoned places
[
  { "metric": "places_visited", "operator": ">=", "value": 10, "filter": { "category_id": 5 } },
  { "metric": "places_visited", "operator": ">=", "value": 10, "filter": { "category_id": 8 } }
]
```

---

## `AchievementsLibrary.php` Design

```
server/app/Libraries/AchievementsLibrary.php
```

### Public interface

```php
class AchievementsLibrary
{
    /**
     * Lightweight hook called from ActivityLibrary::_add() after every user action.
     * Filters to achievements whose metrics relate to $activityType before full eval.
     */
    public function check(string $userId, string $activityType): void;

    /**
     * Full evaluation for one user — used by cron and check().
     * Skips already-earned achievements. Returns newly earned IDs.
     */
    public function evaluate(string $userId): array;

    /**
     * Live progress for all active achievements for a user.
     * Shape: [ achievementId => [ 'current' => int, 'required' => int, 'pct' => float ] ]
     */
    public function getProgress(string $userId): array;

    private function evaluateRules(string $userId, array $rules, ?string $from, ?string $to): bool;
    private function resolveMetric(string $userId, array $condition, ?string $from, ?string $to): int;
    private function awardAchievement(string $userId, string $achievementId, array $progressSnapshot): void;
}
```

### Integration in `ActivityLibrary::_add()`

After the existing `LevelsLibrary::push()` call, add:

```php
$achievementsLib = new AchievementsLibrary();
$achievementsLib->check($userId, $type);
```

`check()` performs a fast pre-filter — it maps activity types to relevant metric keys and only calls `evaluate()` for achievements that use those metrics, avoiding a full DB scan on every action.

### Seasonal date scoping

When an achievement has `season_start` and `season_end`, `resolveMetric()` appends `WHERE created_at BETWEEN :from AND :to` to all count queries. For point-in-time metrics (`reputation_score`, `experience_total`, `level_reached`) seasonal scoping is silently ignored — they are always evaluated against current values.

---

## Cron Command: `achievements:evaluate`

```
server/app/Commands/EvaluateAchievements.php
```

Runs nightly. Process:

1. Query users with activity in the last N hours (default 24; configurable via `--hours=N`).
2. For each user call `AchievementsLibrary::evaluate($userId)`.
3. Newly earned rows land in `users_achievements` with `notified = 0`, `emailed = 0`.
4. After the evaluation loop, dispatch in-app notifications and queue emails for all `notified = 0` / `emailed = 0` rows.

```bash
php spark achievements:evaluate              # users active in last 24h
php spark achievements:evaluate --all        # all users (weekly full sweep)
php spark achievements:evaluate --user=abc   # single user (debug/admin)
php spark achievements:evaluate --no-notify  # skip notifications (initial deploy sweep)
```

---

## Notification Flow

### In-app notification

`awardAchievement()` immediately calls:

```php
$notifyLib = new NotifyLibrary();
$notifyLib->push('achievements', $userId, null, json_encode([
    'achievement_id'   => $achievementId,
    'achievement_slug' => $slug,
    'tier'             => $tier,
    'title'            => lang("Achievements.{$slug}"),
]));
```

`NotifyLibrary` already accepts `'achievements'` as a valid type — no changes needed.

### Email notification

The `SendEmail` command gains an `achievement` template. The cron sweeps `users_achievements WHERE emailed = 0`, joins `users` for locale and email address, sends one email per unnotified achievement, then sets `emailed = 1`.

Email contents: badge icon, tier label, achievement title and description, earned date, CTA button linking to the user's profile achievements tab.

---

## API Endpoints

### Public catalogue

```
GET /achievements
```

Returns all active base achievements + currently active seasonal achievements. Authenticated requests also include per-achievement `progress` and `earned_at`.

Query params: `?category=`, `?tier=bronze|silver|gold`, `?type=base|seasonal`

Response:
```json
{
  "data": [
    {
      "id": "abc123",
      "slug": "explorer_bronze",
      "type": "base",
      "tier": "bronze",
      "category": "exploration",
      "title": "Explorer",
      "description": "Create your first 10 geotags",
      "icon": "Compass",
      "xp_bonus": 10,
      "season_start": null,
      "season_end": null,
      "earned_at": null,
      "progress": { "current": 4, "required": 10, "pct": 40 }
    }
  ]
}
```

### User achievements (profile)

```
GET /users/:id/achievements
```

Public — no auth required. Returns only earned achievements (with `earned_at` and tier). Used to render the badge shelf on user profiles.

### Progress (authenticated)

```
GET /achievements/progress
```

Returns progress for all active achievements for the currently authenticated user.

### Admin CRUD (role: admin)

```
GET    /achievements/manage       # full list including inactive and future seasonal
POST   /achievements              # create
GET    /achievements/:id          # single record
PUT    /achievements/:id          # update
DELETE /achievements/:id          # soft-delete (sets is_active = 0)
POST   /achievements/:id/activate # re-activate
```

All admin endpoints enforce `$this->request->user->role === 'admin'`, returning `403` otherwise.

---

## Language Files

```
server/app/Language/en/Achievements.php
server/app/Language/ru/Achievements.php
```

Keys needed: `notFound`, `createError`, `updateError`, `deleteError`, and one key per achievement slug for notification titles (e.g. `explorer_bronze` → `"You've become an Explorer!"`).

---

## Frontend

### Achievements Catalogue Page

- Route: `pages/achievements/index.tsx`
- Three filter tabs at the top: **All** / **Base** / **Seasonal**
- Category pill filters below tabs (derived dynamically from API data)
- Results grouped by tier within each category (Gold first, then Silver, then Bronze)
- Each card: icon, title, tier badge chip, short description, progress bar (authenticated), "Earned [date]" stamp if completed
- Unauthenticated users see cards without progress bars, with a sign-in CTA

### User Profile Achievements Tab

- Add an **Achievements** tab to the existing user profile page
- Badge shelf: earned achievements, sorted by tier desc then `earned_at` desc
- Each badge: icon with tier-color ring, title, earned date in tooltip on hover
- Clicking a badge opens a detail modal: full description, rules in human-readable form (e.g. *"Earn this by creating 50 geotags"*), earned date

### Admin Management UI

- Route: `pages/admin/achievements/index.tsx`, role-guarded (redirect to `/` for non-admins)
- Data table: Icon | Title | Tier | Type | Category | Active season dates | Status | Actions
- **Add / Edit modal:**
  - Title and description fields for EN and RU
  - Selects for: category, tier, type (base/seasonal)
  - Season date pickers (visible only when type = seasonal)
  - XP bonus input
  - Icon picker
  - **Rules builder:** dynamic list of condition rows. Each row has: metric dropdown, operator select (`>=`, `>`, `=`), value input, optional filter (category select or tag select). Add/remove rows. Live JSON preview at the bottom.
- **Delete:** soft-delete with confirmation dialog; rows in `users_achievements` are never hard-deleted

### RTK Query endpoints to add

```typescript
getAchievements(params?: { category?: string; tier?: string; type?: string })
getUserAchievements(userId: string)
getAchievementsProgress()
// admin:
createAchievement(body: AchievementInput)
updateAchievement(id: string, body: AchievementInput)
deleteAchievement(id: string)
activateAchievement(id: string)
```

---

## Seed Data Catalogue

### Exploration

| Slug | Tier | Rules (simplified) |
|------|------|--------------------|
| `explorer_bronze` | Bronze | places_created >= 10 |
| `explorer_silver` | Silver | places_created >= 50 |
| `explorer_gold`   | Gold   | places_created >= 200 |
| `wanderer_bronze` | Bronze | places_visited >= 25 |
| `wanderer_silver` | Silver | places_visited >= 100 |
| `wanderer_gold`   | Gold   | places_visited >= 500 |

### Content

| Slug | Tier | Rules (simplified) |
|------|------|--------------------|
| `photographer_bronze` | Bronze | photos_uploaded >= 20 |
| `photographer_silver` | Silver | photos_uploaded >= 100 |
| `photographer_gold`   | Gold   | photos_uploaded >= 500 |
| `curator_bronze`      | Bronze | places_edited >= 10 |
| `curator_silver`      | Silver | places_edited >= 50 |
| `curator_gold`        | Gold   | places_edited >= 200 AND comments_written >= 50 |

### Social

| Slug | Tier | Rules (simplified) |
|------|------|--------------------|
| `critic_bronze`    | Bronze | ratings_given >= 20 |
| `critic_silver`    | Silver | ratings_given >= 100 |
| `commenter_bronze` | Bronze | comments_written >= 10 |
| `commenter_silver` | Silver | comments_written >= 50 |
| `commenter_gold`   | Gold   | comments_written >= 200 |
| `collector`        | Bronze | bookmarks_added >= 30 |

### Reputation

| Slug | Tier | Rules (simplified) |
|------|------|--------------------|
| `trusted_bronze` | Bronze | reputation_score >= 50 |
| `trusted_silver` | Silver | reputation_score >= 200 |
| `trusted_gold`   | Gold   | reputation_score >= 1000 |
| `veteran_bronze` | Bronze | level_reached >= 5 |
| `veteran_silver` | Silver | level_reached >= 15 |
| `veteran_gold`   | Gold   | level_reached >= 25 |

### Consistency

| Slug | Tier | Rules (simplified) |
|------|------|--------------------|
| `regular_bronze` | Bronze | days_active >= 7 |
| `regular_silver` | Silver | days_active >= 30 |
| `regular_gold`   | Gold   | days_active >= 100 |
| `streak_bronze`  | Bronze | login_streak >= 7 |
| `streak_silver`  | Silver | login_streak >= 30 |

### Seasonal examples

| Slug | Tier | Window | Rules (simplified) |
|------|------|--------|--------------------|
| `spring_explorer_2026`     | Silver | 2026-03-01 → 2026-05-31 | places_visited {category:monuments} >= 10 AND places_visited {category:abandoned} >= 10 |
| `summer_photographer_2026` | Gold   | 2026-06-01 → 2026-08-31 | photos_uploaded >= 50 |
| `autumn_curator_2026`      | Silver | 2026-09-01 → 2026-11-30 | places_edited >= 20 AND ratings_given >= 30 |

---

## Implementation Plan

### Phase 1 — Schema & Core Library
1. Migration `RebuildAchievements`: drop and recreate `achievements` + `users_achievements`.
2. Seed new achievement catalogue.
3. Implement `AchievementsLibrary` (`check`, `evaluate`, `getProgress`, `resolveMetric`, `awardAchievement`).
4. Hook `check()` into `ActivityLibrary::_add()`.

### Phase 2 — API & Language Files
5. `Achievements` controller with all endpoints listed above.
6. Language files `en/Achievements.php` + `ru/Achievements.php`.
7. Register routes in `Config/Routes.php`.

### Phase 3 — Cron & Notifications
8. `EvaluateAchievements` cron command.
9. Achievement email template in `SendEmail`.

### Phase 4 — Frontend: Catalogue
10. `pages/achievements/index.tsx` with tabs, category pills, tier grouping, progress bars.
11. RTK Query endpoints for catalogue and progress.
12. i18n keys for the achievements page.

### Phase 5 — Frontend: Profile & Admin
13. Achievements tab on user profile (`earned_at`, badge shelf, detail modal).
14. Admin page with data table, add/edit modal, and rules builder component.

---

## Notes & Future Considerations

- **Ghost place captures** (Feature 11) introduce a `ghost_captures` metric — add it to `resolveMetric()` when that feature lands.
- **Retroactive initial sweep:** on first deploy run `php spark achievements:evaluate --all --no-notify` to award already-earned badges without spamming existing users with notifications.
- **No revocation:** once earned, a badge is permanent. If an admin raises a threshold, existing earners keep their badge.
- **Progress caching:** if `getProgress()` query load becomes significant, cache per-user progress in Redis with a short TTL, busted on any `activity` insert for that user.
- **Multi-locale admin titles:** if more languages are added later, migrate `title_en`/`title_ru` columns to a separate `achievement_translations` table.
