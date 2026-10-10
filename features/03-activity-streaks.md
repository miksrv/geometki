# Feature: Activity Streaks

> **Status: not started**

## Overview

Reward users for showing up consistently. A streak counts consecutive calendar days with at least one qualifying action. Longer streaks multiply earned XP.

Already exists: the achievements `streak` (metric `login_streak`, 7/30/60 days, computed from `sessions_history`), `regular` and `dedicated` (metric `days_active`). This feature adds a visible streak counter and an XP multiplier, not more streak badges.

## Streak Tracking

New columns on `users`:
```sql
current_streak   SMALLINT UNSIGNED DEFAULT 0,
longest_streak   SMALLINT UNSIGNED DEFAULT 0,
last_active_date DATE DEFAULT NULL
```

On every activity recorded by `ActivityLibrary`:
1. Same day as `last_active_date` → no change.
2. Yesterday → `current_streak += 1`.
3. Older / NULL → `current_streak = 1`.
4. Update `last_active_date`; bump `longest_streak` if exceeded.

## XP Multiplier

| Streak Length | XP Multiplier |
|--------------|--------------|
| 1–6 days | ×1.0 |
| 7–13 days | ×1.1 |
| 14–29 days | ×1.25 |
| 30–59 days | ×1.5 |
| 60+ days | ×2.0 |

Applied in `LevelsLibrary::push()`. Note that `LevelsLibrary::calculate()` recomputes total XP from activity counts × `MODIFIER_*` (`server/app/Config/Constants.php`), so a multiplier needs the bonus stored separately or the recalculation will drop it.

## API & Client

- `current_streak`, `longest_streak` added to `GET /users/{id}` (`UserEntity`); no new endpoints.
- `UserHeader`: flame icon with day count next to level and reputation; tooltip with current/longest streak and active multiplier.
- Optional: 90-day activity heatmap on the profile from the `activity` table.

## Streak Freeze (optional)

One freeze per month (from a minimum level) so a single missed day does not break a long streak.
