# Feature: Activity Streaks

> **Status: not started**

## Overview

Reward users for showing up consistently. A streak counts consecutive calendar days with at least one qualifying action. Longer streaks multiply earned XP.

Already exists: the achievements `streak` (metric `login_streak`, 7/30/60 days, consecutive days with activity, counted like the profile's contribution calendar), `regular` and `dedicated` (metric `days_active`). This feature adds a visible streak counter and an XP multiplier, not more streak badges.

## Streak Tracking

New columns on `users`:
```sql
current_streak   SMALLINT UNSIGNED DEFAULT 0,
longest_streak   SMALLINT UNSIGNED DEFAULT 0,
last_active_date DATE DEFAULT NULL
```

A qualifying action is one that gives experience: a place, a photo, an edit, a comment, a rating by
a signed-in user, a visit with photos or answers. A bare visit (one tap, no location) does not count,
or a streak would cost one tap a day.

On every qualifying activity recorded by `ActivityLibrary`:
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

Experience is counted from the log of actions (`LevelsLibrary::experience()`, `MODIFIER_*` in `server/app/Config/Constants.php`), so the bonus must be in the log too: the activity stores the multiplier it was earned with (`activity.multiplier`), `experience()` applies it, and `ActivityRemoval` takes the bonus back with the action. Pushing the bonus alone would be lost on the next recount.

## API & Client

- `current_streak`, `longest_streak` added to `GET /users/{id}` (`UserEntity`); no new endpoints.
- `UserHeader`: flame icon with day count next to level and reputation; tooltip with current/longest streak and active multiplier.

## Streak Freeze (optional)

One freeze per month (from a minimum level) so a single missed day does not break a long streak.
