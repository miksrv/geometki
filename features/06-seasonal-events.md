# Feature: Seasonal Events & Limited-Time Campaigns

## Overview

Timed community events focused on a theme (season, holiday, category of place) that give all users a shared goal. Events create urgency, bring back inactive users, and generate topical content clusters on the map.

## Event Structure

An event runs for 1–4 weeks and has:
- A **theme** (e.g., "Summer Beaches", "Hidden Cafés of Winter", "Soviet Architecture")
- A **global goal** (community collectively adds N places of a type)
- **Individual goals** with tiered rewards
- An **exclusive badge** only earnable during the event window

### Example Events

| Event | Window | Goal | Exclusive Badge |
|-------|--------|------|----------------|
| Summer Expedition | Jul 1–Aug 31 | Add 1,000 outdoor places | "Sun Seeker" |
| Café Crawl | Mar 1–Mar 31 | Add 500 cafés/restaurants | "Barista's Friend" |
| Heritage Hunt | Sep 1–Oct 15 | Add 300 historical landmarks | "Time Keeper" |
| Winter Wonderland | Dec 1–Jan 10 | Add 200 winter activity spots | "Frost Wanderer" |

### Individual Contribution Tiers

Within an event, users who contribute themed places unlock tiered rewards:

| Contributions | XP Bonus | Reward |
|--------------|---------|--------|
| 1 place | +50 XP | Bronze event badge |
| 5 places | +200 XP | Silver event badge |
| 15 places | +500 XP | Gold event badge |
| Top 10 leaderboard | +1,000 XP | Exclusive "Elite" variant badge |

### Community Progress Bar

A global progress tracker shows the community's collective progress toward the event goal. When the goal is reached, everyone who participated gets a +100 XP "Community Victory" bonus.

## Server Design

**New table: `events`**
```sql
id, title_en, title_ru, description_en, description_ru,
category_filter (JSON array of place category IDs),
starts_at, ends_at,
community_goal INT,
community_progress INT DEFAULT 0,
bronze_threshold, silver_threshold, gold_threshold
```

**New table: `users_events`**
```sql
id, user_id, event_id, contribution_count, tier_reached, bonus_awarded
```

**`EventsLibrary.php`**
- `getActive(): ?Event` — return the currently running event, if any.
- `trackContribution(int $userId, int $placeId)` — called when a place is added; check if it matches the event's category filter; increment user and community counters; award tier bonuses as thresholds are crossed.

**Routes**
- `GET /events/active` — current event details + authenticated user's progress.
- `GET /events/{id}/leaderboard` — top contributors for a specific event.
- `GET /events` — archive of past events.

## Client Design

**Event banner** — sticky banner on the main page and map during an active event, showing:
- Event name and theme art
- Community progress bar ("847 / 1,000 places added")
- User's current tier and progress to next tier
- Time remaining countdown

**Event leaderboard modal** — top 10 contributors with their tier badges; accessible from the banner.

**Past events archive** (`/events`) — shows all historical events with community outcomes; users can see which badges they earned.

**Map integration** — places added during an active event get a small themed marker pin (e.g., a snowflake overlay in winter), creating visible clusters of event content.

## Admin Considerations

- Events are created via database seed or a future admin panel; no user-facing creation UI needed initially.
- Category filter is a JSON array of place `category_id` values, making event scoping flexible.
- Events can overlap (e.g., a regional campaign and a category campaign simultaneously).

## Why It Fits

Events require no changes to core place-addition flow — `ActivityLibrary::push()` for the `place` action type is the only hook needed. The seasonal rhythm gives the platform a living calendar of moments that PR/social media can amplify, driving acquisition alongside retention.
