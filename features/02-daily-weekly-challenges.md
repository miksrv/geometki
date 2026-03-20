# Feature: Daily & Weekly Challenges

## Overview

Time-boxed tasks that give users a reason to open the app every day. A rotating set of challenges resets on a schedule; completing them awards bonus XP and a streak multiplier.

## How It Works

### Challenge Types

| Scope | Example Task | Bonus XP |
|-------|-------------|---------|
| Daily | Add 1 new place today | +30 XP |
| Daily | Upload 3 photos today | +20 XP |
| Daily | Rate 5 places today | +15 XP |
| Weekly | Add 10 places this week | +150 XP |
| Weekly | Contribute to 3 different cities | +200 XP |
| Weekly | Be the first to add a photo to 5 places | +100 XP |

### Server Design

**New table: `challenges`**
```sql
id, title_en, title_ru, description_en, description_ru,
type ENUM('daily','weekly'), action_type, target_count,
bonus_xp, active_from, active_until
```

**New table: `users_challenges`**
```sql
id, user_id, challenge_id, progress, completed_at
```

**`ChallengesLibrary.php`**
- `getActive(): array` — return today's/this week's challenges.
- `increment(string $actionType, int $userId)` — called from `ActivityLibrary::push()` to advance challenge progress.
- `complete(int $userId, int $challengeId)` — award bonus XP via `LevelsLibrary::push()`, mark done.

A scheduled task (CI4 Spark command, run via cron) rotates challenges daily/weekly and resets user progress.

**Routes**
- `GET /challenges` — active challenges with authenticated user's progress.
- `GET /challenges/history` — completed challenges for the current user.

### Client Design

**Challenge widget** — small card on the dashboard and user profile showing:
- Active challenges with a progress bar (`2/5 photos`)
- Time remaining until reset (countdown)
- Completed challenges shown with a checkmark and XP earned

**Notification** — push/in-app notification when a challenge is completed.

## Engagement Mechanics

- Challenges are the same for all users (community event feel).
- Weekly challenges can include geo-specific tasks ("add a place in a city you haven't contributed to before") using the existing coordinates infrastructure.
- Optional "challenge streak" counter: completing all daily challenges 7 days in a row unlocks an achievement.

## Why It Fits

The activity log and XP system are already action-aware (`photo`, `place`, `rating`, `edit`, `cover`, `comment`). Plugging challenge progress tracking into `ActivityLibrary::push()` is a natural extension with no changes to existing flow.
