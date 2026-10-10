# Feature: Daily & Weekly Challenges

> **Status: not started**

## Overview

Time-boxed tasks that give users a reason to open the site every day. A rotating set of challenges resets on a schedule; completing one awards bonus XP. Challenges are the same for all users (community event feel).

## Challenge Types

| Scope | Example Task | Bonus XP |
|-------|-------------|---------|
| Daily | Add 1 new place today | +30 XP |
| Daily | Upload 3 photos today | +20 XP |
| Daily | Rate 5 places today | +15 XP |
| Weekly | Add 10 places this week | +150 XP |
| Weekly | Contribute to 3 different cities | +200 XP |
| Weekly | Be the first to add a photo to 5 places | +100 XP |

Weekly challenges can be geo-specific ("add a place in a city you haven't contributed to before") using the location data (`location_*` tables).

## Server Design

**Table `challenges`**
```sql
id, title_en, title_ru, description_en, description_ru,
type ENUM('daily','weekly'), action_type, target_count,
bonus_xp, active_from, active_until
```

**Table `users_challenges`**
```sql
id, user_id, challenge_id, progress, completed_at
```

**`ChallengesLibrary.php`**
- `getActive(): array` — today's / this week's challenges.
- `increment(string $actionType, string $userId)` — called from `ActivityLibrary` next to `LevelsLibrary::push()` / `AchievementsLibrary::check()`.
- `complete(string $userId, string $challengeId)` — award bonus XP, mark done.

A Spark command run by cron rotates challenges and resets progress.

**Routes**
- `GET /challenges` — active challenges with the authenticated user's progress.
- `GET /challenges/history` — completed challenges of the current user.

## Client Design

- Challenge widget (user profile, main page): progress bar per challenge (`2/5 photos`), countdown to reset, completed ones with a checkmark and XP earned.
- In-app notification on completion.
- Optional: completing all daily challenges 7 days in a row unlocks an achievement (new metric in `AchievementsLibrary::resolveMetric()`).
