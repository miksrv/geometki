# Feature: Social Kudos & Peer Endorsements

> **Status: not started**

## Overview

Let users recognize each other's contributions with typed endorsements. Receiving kudos boosts reputation and shows social proof on the profile.

## Kudos Types

| Kudos | Awarded For |
|-------|-------------|
| Accurate Mapper | Correct coordinates, complete places |
| Great Photographer | High-quality photos |
| Helpful Reviewer | Insightful ratings and comments |
| Local Expert | Deep knowledge of a specific area |
| Quick Updater | Fast to correct outdated info |

## Mechanics

- One kudos per type per recipient per month.
- Giver earns +2 XP; recipient earns +5 reputation and +10 XP.
- Counts are public on the profile; the dominant type is shown as "Known for".

### Reputation

`ReputationLibrary::recalculate()` rebuilds `users.reputation` from scratch out of ratings of the user's places, so kudos must be added inside that calculation (sum from the `kudos` table), not as a one-off increment that the next recalculation would wipe.

## Server Design

**Table `kudos`**
```sql
id, giver_id, receiver_id, kudos_type ENUM(...), created_at
-- monthly uniqueness enforced in code (or via a generated YYYY-MM column + UNIQUE)
```

**Routes (`Kudos` controller)**
- `POST /users/{id}/kudos` — body `{ type: "accurate_mapper" }`; validates the monthly limit, awards XP/reputation, sends a notification.
- `GET /users/{id}/kudos` — counts per type, total, recent givers.

## Client Design

- Profile: row of kudos types with counts, "Known for" label, "Give kudos" button on other users' profiles.
- Notification: "Alice gave you 'Great Photographer'".
- Optional `/users` sort by kudos received this month.

## Anti-Abuse

- Monthly per-type limit.
- Givers need a minimum level (filters out brand-new accounts).
- 20+ kudos of one type within 30 days → soft review flag (logged, not penalized).
