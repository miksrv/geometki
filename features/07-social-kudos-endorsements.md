# Feature: Social Kudos & Peer Endorsements

## Overview

Let users recognize each other's contributions directly. A lightweight "kudos" system allows any user to give a fellow contributor a typed endorsement (e.g., "Great Photographer", "Accurate Mapper"). Receiving kudos boosts reputation and provides social proof on the recipient's profile.

## How It Works

### Kudos Types

Pre-defined endorsement categories, each tied to a contribution style:

| Kudos | Icon | Awarded For |
|-------|------|-------------|
| Accurate Mapper | 📍 | Their places have correct coordinates / high quality scores |
| Great Photographer | 📷 | Their photos are high-quality |
| Helpful Reviewer | ⭐ | Their ratings and comments are insightful |
| Local Expert | 🏙️ | Deep knowledge of a specific region |
| Quick Updater | ✏️ | Fast to correct outdated info |

### Mechanics

- A user can give **one kudos per type per recipient per month** (prevents farming).
- Giving kudos costs nothing and earns the giver +2 XP (encourages generosity).
- Receiving kudos earns the recipient **+5 reputation** and **+10 XP** per kudos.
- Kudos counts are public on user profiles; the top kudos type is displayed as a "Known for" label.

### Reputation Integration

Kudos reputation feeds into the existing `users.reputation` field, which already influences leveling. No new column needed — it's just another reputation-modifying event.

### Server Design

**New table: `kudos`**
```sql
id, giver_id, receiver_id, kudos_type ENUM(...),
created_at
-- UNIQUE KEY (giver_id, receiver_id, kudos_type, MONTH(created_at))
```

**`KudosController.php`**
- `POST /users/{id}/kudos` — give kudos; body: `{ type: "accurate_mapper" }`.
  - Validate monthly limit; award XP to giver, XP + reputation to receiver; send notification.
- `GET /users/{id}/kudos` — return kudos summary for a user (count per type, total, recent givers).

### Client Design

**User profile** — "Kudos" section below stats:
- Row of kudos type icons with counts.
- "Known for: Accurate Mapper" highlight if one type dominates.
- "Give Kudos" button (visible when viewing another user's profile); dropdown of kudos types.

**Activity feed** — "Alice gave you 'Great Photographer' kudos" notification.

**Users list page** — optional sort by "most kudos received this month".

### Anti-Abuse

- Monthly per-type limit prevents trading kudos between two accounts.
- Givers must be Level 3+ to give kudos (requires ~300 XP, filters out brand-new accounts).
- Receiving 20+ kudos of the same type in a 30-day window triggers a soft review flag (logged, not auto-penalized).

## Why It Fits

Reputation already exists as a core metric but is currently only driven by place ratings. Kudos adds a **social reputation signal** — recognition from peers rather than the public — which feels more personal and meaningful. It also gives mid-level users (who can't yet compete on quantity with power users) a way to feel valued for the quality of their specific contributions.
