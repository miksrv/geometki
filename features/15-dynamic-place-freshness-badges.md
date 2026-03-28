# Feature: Dynamic Place Freshness Badges

## Overview

Every place displays a visible freshness badge signaling its content completeness and recency. Badges decay over time if a place isn't maintained — a "Verified" place drops to "Complete" after 6 months of inactivity. Decaying badges trigger notifications to the place creator, pulling them back to update and re-verify their contributions. This converts place creation from a one-time event into a long-term investment.

**Effort:** Medium (4–5 days backend + 3–4 days frontend)
**Impact:** High — creates a recurring maintenance loop for creators, quality signal for explorers, and daily challenge integration point
**Phase:** 2

---

## Core Problem It Solves

Currently, once a user creates a place, their relationship with it is over. The place sits in the database unchanged. There's no mechanism that asks them to come back to verify it, improve it, or update it. The freshness badge system creates **ongoing skin in the game**: your places can earn a gold "Exemplary" badge, but they can also lose it. The threat of losing a badge you earned is a stronger re-engagement pull than any positive reward.

For explorers, badges answer the immediate trust question: "Is this information current?" A gray "Stub" marker signals a gamble; a blue "Verified" marker signals confidence. Better information quality improves the core product experience for every user.

---

## Badge Tiers

| # | Tier | Badge | Visual | Criteria |
|---|------|-------|--------|----------|
| 1 | **Stub** | 🔘 | Gray, dashed outline | Title only — no description, no photos |
| 2 | **Draft** | 🟡 | Yellow outline | Has description OR 1 photo, but not both |
| 3 | **Complete** | 🟢 | Green solid | Description AND 2+ photos AND 1+ tag |
| 4 | **Verified** | 🔵 | Blue with checkmark | Complete + edited within 6 months + 3+ ratings |
| 5 | **Exemplary** | 🌟 | Gold with star | Verified + 5+ photos + 10+ ratings + updated within 3 months |

---

## Scoring Formula

### Base Score (0–100)

```
base_score =
    (has_description         ?  15 : 0) +
    (description_length > 200?  10 : 0) +
    (min(photos_count, 5)    *   5    ) +   -- max 25 pts from photos
    (min(tags_count, 5)      *   3    ) +   -- max 15 pts from tags
    (min(ratings_count, 10)  *   2    ) +   -- max 20 pts from ratings
    (avg_rating >= 4.0       ?  10 : 0) +
    (has_cover_photo         ?   5 : 0)
```

Max base_score = 100.

### Freshness Multiplier

```
days = days_since(last_meaningful_update)

freshness_multiplier =
    days <= 90  ? 1.00 :
    days <= 180 ? 0.85 :
    days <= 365 ? 0.70 :
                  0.50
```

### Final Score and Tier Assignment

```
final_score = base_score * freshness_multiplier

tier =
    final_score >= 85 AND days <= 90  → Exemplary
    final_score >= 60 AND days <= 180 → Verified
    final_score >= 35                 → Complete
    final_score >= 10                 → Draft
    final_score <  10                 → Stub
```

Note: Exemplary and Verified have hard date caps regardless of score. A place with perfect content but no update in 7 months cannot be Verified. This forces recency, not just volume.

### What Counts as a "Meaningful Update"

The `last_meaningful_update` timestamp resets on any of these events:
- Place description edited (character count change > 20 — prevents whitespace saves)
- New photo uploaded to the place
- Cover photo changed
- New tag added
- Place author leaves a new comment on the place
- A registered user confirms the place still exists via "Confirm visit" action (new lightweight action, see below)

**Does NOT reset the clock:**
- Rating or comment from another user (these are not the creator's updates)
- Viewing the place
- Bookmarking

---

## Server Design

### Schema Changes

**Add to `places` table:**
```sql
ALTER TABLE places
    ADD COLUMN freshness_score     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN freshness_tier      ENUM('stub','draft','complete','verified','exemplary') NOT NULL DEFAULT 'stub',
    ADD COLUMN last_meaningful_update DATETIME NULL,
    ADD KEY idx_freshness_tier (freshness_tier),
    ADD KEY idx_last_meaningful_update (last_meaningful_update);
```

**Add to `users` table (for profile stats):**
```sql
ALTER TABLE users
    ADD COLUMN places_exemplary  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN places_verified   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN places_needing_attention SMALLINT UNSIGNED NOT NULL DEFAULT 0;
```

These counters are updated by the nightly cron for profile display without an expensive GROUP BY query.

### Recalculation Logic: `FreshnessLibrary.php`

```php
class FreshnessLibrary
{
    public static function recalculate(int $placeId): void
    {
        $place = PlaceModel::find($placeId);
        $score = self::computeScore($place);
        $tier  = self::computeTier($score, $place->last_meaningful_update);

        PlaceModel::update($placeId, [
            'freshness_score' => $score,
            'freshness_tier'  => $tier,
        ]);

        // If tier degraded, enqueue notification
        if ($tier !== $place->freshness_tier && self::tierRank($tier) < self::tierRank($place->freshness_tier)) {
            NotificationLibrary::enqueue($place->user_id, 'place_freshness_dropped', [
                'place_id'    => $placeId,
                'place_name'  => $place->title,
                'old_tier'    => $place->freshness_tier,
                'new_tier'    => $tier,
            ]);
        }
    }

    public static function markMeaningfulUpdate(int $placeId): void
    {
        PlaceModel::update($placeId, ['last_meaningful_update' => date('Y-m-d H:i:s')]);
        self::recalculate($placeId);
    }
}
```

Call `FreshnessLibrary::markMeaningfulUpdate($placeId)` in:
- `PlaceController::update()`
- `PhotoController::upload()` (when attaching to a place)
- `CommentController::store()` (only when commenter is place owner)

### Cron Job: `FreshnessRecalculateCommand.php`

Runs nightly at 03:00 UTC:
```php
// 1. Recalculate all places where last_meaningful_update changed
//    OR where the tier might decay due to time passing (days-based thresholds)
// 2. Find places near the 90/180-day threshold crossing:
//    WHERE last_meaningful_update BETWEEN DATE_SUB(NOW(), INTERVAL 97 DAY)
//                                     AND DATE_SUB(NOW(), INTERVAL 83 DAY)
//    These are approaching the 90-day Exemplary cliff → send advance warning at day 83
// 3. Update users.places_exemplary, places_verified, places_needing_attention counters
```

### New Lightweight Action: "Confirm Visit"

A user who recently visited a place can tap "I was just here" on the place page. This:
- Adds a `users_visited_places` row (already exists)
- If the visitor IS the place author: resets `last_meaningful_update` (confirming the place still exists)
- If the visitor is NOT the author: does NOT reset the clock (only the author is responsible for accuracy), but contributes to the rating invitation prompt ("You visited — would you like to rate this place?")

### API Modifications

**`GET /places/{id}`** — add to response:
```json
{
  "freshness_tier": "verified",
  "freshness_score": 72,
  "last_meaningful_update": "2025-11-14T10:23:00Z"
}
```

**`GET /places`** (list/catalog endpoint) — add optional filter:
```
?freshness_tier=verified        -- show only Verified+
?freshness_tier=stub,draft      -- show only places needing improvement (for challenge integration)
```

**`GET /users/{id}/places`** — add optional filter:
```
?needs_attention=1  -- places where freshness_tier dropped since last check
```

---

## Notifications

### Tier Drop Notification (in-app + email)

Triggered when `freshness_tier` decreases:

| Drop | Message |
|------|---------|
| Exemplary → Verified | "Your place **[Café Pushkin]** will lose its gold badge in 2 weeks — update it to keep Exemplary status." |
| Verified → Complete | "Your place **[Café Pushkin]** dropped from Verified to Complete. It hasn't been updated in 7 months. Is the information still accurate?" |
| Complete → Draft | "Your place **[Café Pushkin]** is becoming outdated. Consider adding more photos or updating the description." |

### Weekly Digest for Prolific Creators

Users with 10+ places receive a weekly digest (bundled with the general weekly digest from Feature 16) listing:
```
3 of your places need attention this week:
  → Café Pushkin          Verified → Complete  [Update →]
  → Arbat Bookshop        Complete → Draft     [Update →]
  → Street Art Wall       Stub                 [Improve →]
```

### Advance Warning (Exemplary approaching decay)

At day 83 (7 days before the 90-day Exemplary threshold):
"Your Exemplary place **[Name]** will lose its gold badge in 7 days unless updated. One new photo is enough."

Notification throttle: max one advance warning per place per quarter.

---

## Client Design

### `FreshnessBadge` Component

```tsx
type FreshnessTier = 'stub' | 'draft' | 'complete' | 'verified' | 'exemplary';

interface FreshnessBadgeProps {
    tier: FreshnessTier;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}
```

Visual design:
- `sm` (map popup, place card): icon only (16px)
- `md` (place list): icon + short label ("Verified")
- `lg` (place detail page header): icon + full label + last-updated hint ("Updated 3 months ago")

Badge display locations:
1. **Place card** in catalog/search: small icon next to title
2. **Map popup:** small icon in top-right corner of popup
3. **Place detail page header:** medium badge below the title
4. **User profile:** freshness distribution row (see below)

### User Profile — Freshness Stats Section

Below the existing stats (places count, photos, ratings):

```
📊 Place Quality
────────────────────────────────
🌟 Exemplary     12 places
🔵 Verified      34 places
🟢 Complete      18 places
⚠️  Need attention  3 places  [View →]
```

The "Need attention" count links to `/users/me/places?needs_attention=1` — the places list filtered to only degraded places.

### Map Filter Integration

In the existing map layer controls (already has category filter), add a **Quality Filter** toggle group:
- [All] [Verified+] [Complete+] [Stubs only]

"Stubs only" is useful for contribution-mode users looking for places to improve. "Verified+" is useful for travelers who want reliable information.

### "Needs Attention" Tab on User's Place List

On `/users/me/places`, add a tab or filter: **"Needs attention"** — showing only places where freshness_tier dropped since the user last visited their profile. Each row shows the old tier → new tier with an inline "Update" button.

---

## Daily Challenge Integration

The freshness system integrates cleanly with Feature 02 (Daily/Weekly Challenges):

| Challenge | Condition | XP |
|-----------|-----------|-----|
| "Update a neglected place" | Edit a place that is in Draft or lower | +50 XP |
| "Bring 3 Stubs to Draft" | Add a description to 3 Stub places (any user's) | +60 XP |
| "Maintain your Exemplary" | Update an Exemplary place before it decays | +40 XP |
| Weekly: "Quality week" | Have 5 of your places reach Verified or higher | +200 XP |

---

## Edge Cases

- **Place with no description and 10 photos:** Score = 25, tier = Draft. The description requirement is real.
- **Very old legacy place:** Places created before this feature launches get `last_meaningful_update = created_at`. All existing places start at their natural tier. No retroactive punishment.
- **Deleted photos:** If photos are deleted and count drops below the threshold, freshness_score is recalculated immediately (not waiting for nightly cron).
- **Collaborative places:** If a place has multiple editors, only the place creator receives decay notifications. Other editors receive a nudge only if they are following the creator (follow system Feature 12).

---

## Metrics to Track

- **Average freshness_tier distribution** across all places over time
- **Update rate after notification:** % of notified creators who update within 7 days
- **Exemplary place count month-over-month:** are quality contributions growing?
- **Session length for users who clicked "Needs attention":** freshness-driven sessions should be shorter but highly targeted
