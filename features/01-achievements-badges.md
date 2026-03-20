# Feature: Achievements & Badges (Complete Existing Skeleton)

## Overview

The database schema for achievements already exists (`achievements`, `users_achievements` tables with trigger conditions on `min_count_places`, `min_count_edits`, `min_count_photos`, `min_count_likes`, `min_count_reputation`). This feature completes the system end-to-end.

## Current State

- DB tables and seed data defined — but no evaluation logic, API endpoints, or frontend.
- `ActivityLibrary::push()` calls `LevelsLibrary::push()` but never checks achievements.

## What to Build

### Server

**1. `AchievementsLibrary.php`**
- `check(UserEntity $user): array` — compare user stats against all achievement trigger thresholds; return newly unlocked achievement IDs.
- Call this from `ActivityLibrary::push()` after XP is awarded.
- On unlock: insert into `users_achievements`, dispatch a notification (same channel as level-up).

**2. `AchievementsController.php`**
- `GET /achievements` — full catalogue with unlock status for authenticated user.
- `GET /users/{id}/achievements` — public list of a user's earned badges.

### Client

**Badge display on user profile**
- Grid of badges below user stats in `UserHeader`; locked badges shown greyed-out.
- Badge detail tooltip/modal: name, description, unlock condition, date earned.

**Badge catalogue page** (`/users/achievements`)
- All achievements grouped by category (Explorer, Photographer, Editor, Social).
- Authenticated user sees progress toward each unlock condition.

## Example Achievements

| Badge | Trigger | XP Bonus on Unlock |
|-------|---------|-------------------|
| First Step | 1 place added | 50 |
| Cartographer | 10 places added | 100 |
| Grand Explorer | 100 places added | 500 |
| Lensman | 50 photos uploaded | 150 |
| Respected | 100 reputation | 200 |
| Seasoned Editor | 30 edits | 100 |

## Why It Fits

Achievements are the most requested gamification extension; the groundwork is already in the codebase, so the lift is minimal relative to the user engagement gain. Each unlocked badge also triggers a notification, which brings dormant users back into the app.
