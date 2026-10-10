# Feature: Seasonal Events & Limited-Time Campaigns

> **Status: not started.** Seasonal *achievements* already exist (`achievements.type = 'seasonal'` with `season_start`/`season_end` and rule filters, `AchievementsLibrary`); what is missing is the event itself: a community goal, a banner, a leaderboard and an archive.

## Overview

Timed community events (1–4 weeks) around a theme — usually a set of categories — with a shared community goal, individual tiers and an exclusive badge. They create urgency, bring back inactive users and produce topical clusters on the map.

### Example Events

| Event | Window | Categories | Goal | Badge |
|-------|--------|-----------|------|-------|
| Waters of Summer | Jul 1–Aug 31 | `waterfall`, `spring`, `water` | 1,000 places | "Sun Seeker" |
| Heritage Hunt | Sep 1–Oct 15 | `castle`, `manor`, `architecture`, `archeology` | 300 places | "Time Keeper" |
| Abandoned Autumn | Oct 1–Nov 15 | `abandoned`, `industrial`, `military` | 300 places | "Ruin Walker" |

### Individual Tiers

| Themed places added | XP Bonus | Reward |
|--------------|---------|--------|
| 1 | +50 XP | Bronze event badge |
| 5 | +200 XP | Silver event badge |
| 15 | +500 XP | Gold event badge |
| Top 10 | +1,000 XP | "Elite" badge variant |

The tier badges can be ordinary seasonal achievements with a category filter, so only the community goal and the leaderboard need new code. When the community goal is reached, every participant gets +100 XP.

## Server Design

**Table `events`**
```sql
id, title_en, title_ru, description_en, description_ru,
categories JSON,          -- category keys, e.g. ["castle","manor"]
starts_at, ends_at,
community_goal INT, community_progress INT DEFAULT 0
```

**Table `users_events`**
```sql
id, user_id, event_id, contribution_count, bonus_awarded
```

**`EventsLibrary.php`**
- `getActive(): array` — running events (they may overlap).
- `trackContribution(string $userId, string $placeId)` — called from `ActivityLibrary::place()`; if the place category matches, increments user and community counters.

**Routes**
- `GET /events/active` — current events + the user's progress.
- `GET /events/{id}/leaderboard` — top contributors.
- `GET /events` — archive.

Events are created via a seeder or the admin area; no user-facing creation UI.

## Client Design

- Event banner on the main page and map: name, community progress ("847 / 1,000"), user's tier, countdown.
- Leaderboard modal from the banner.
- `/events` archive with outcomes and earned badges.
- Optional themed marker overlay for places added during the event.
