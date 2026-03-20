# Feature: Activity Streaks

## Overview

Reward users for showing up consistently. A streak counts consecutive calendar days on which a user performed at least one qualifying action. Longer streaks multiply XP earned and unlock streak milestones.

## How It Works

### Streak Tracking

A streak is maintained in the `users` table:
```sql
current_streak   SMALLINT UNSIGNED DEFAULT 0,  -- consecutive active days
longest_streak   SMALLINT UNSIGNED DEFAULT 0,  -- all-time personal best
last_active_date DATE DEFAULT NULL              -- last calendar day with activity
```

On every `ActivityLibrary::push()` call:
1. Compare `last_active_date` to today (UTC).
2. **Same day** → no change (streak already counted).
3. **Yesterday** → `current_streak += 1`; update `last_active_date`.
4. **Older / NULL** → reset `current_streak = 1`; update `last_active_date`.
5. Update `longest_streak` if `current_streak > longest_streak`.

### XP Multiplier

| Streak Length | XP Multiplier |
|--------------|--------------|
| 1–6 days | ×1.0 (baseline) |
| 7–13 days | ×1.1 |
| 14–29 days | ×1.25 |
| 30–59 days | ×1.5 |
| 60+ days | ×2.0 |

The multiplier is applied in `LevelsLibrary::push()` before XP is added, using the user's current streak.

### Streak Milestones (Achievements)

Crossing these thresholds auto-unlocks an achievement (integrates with Feature 01):

| Streak | Achievement |
|--------|------------|
| 7 days | "Week Wanderer" |
| 30 days | "Monthly Explorer" |
| 100 days | "Dedicated Geographer" |
| 365 days | "Year-Round Pioneer" |

### API

- Streak data is included in the existing `GET /users/{id}` response (add `current_streak`, `longest_streak` fields to `UserEntity`).
- No new endpoints needed.

### Client

- Streak counter shown in `UserHeader` alongside level and reputation — a flame icon with day count.
- Tooltip shows: current streak, longest streak, active multiplier.
- On profile page, a small "streak history" heatmap (GitHub contribution graph style) showing activity over the last 90 days, rendered using the existing `activity` table data.

## Streak Freeze (Optional / Future)

Allow users to "freeze" a streak once per month (earned at Level 10+) so a single missed day doesn't break a long streak — a common mechanic in apps like Duolingo that significantly reduces churn.

## Why It Fits

The `activity` table already records every user action with timestamps. Streak calculation is purely additive: one field read + two field writes per action. It adds daily retention pressure without any structural changes to existing XP logic.
