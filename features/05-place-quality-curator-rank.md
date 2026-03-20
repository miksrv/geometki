# Feature: Place Quality Score & Curator Rank

## Overview

Shift the XP model from purely quantity-based to quality-aware. Places accumulate a **Quality Score** based on completeness and community reception. The users who contributed to high-quality places earn ongoing **Curator XP** as the place continues to attract engagement — rewarding long-term stewardship, not just first-entry speed.

## Place Quality Score

### Score Calculation

Each place has a computed `quality_score` (0–100):

| Signal | Points |
|--------|--------|
| Has description (>100 chars) | +15 |
| Has cover photo | +10 |
| Has 3+ photos | +15 |
| Has been rated 5+ times | +20 |
| Average rating ≥ 4.0 | +15 |
| Has been edited/verified after creation | +10 |
| Coordinates confirmed accurate | +15 |

Score is recalculated each time the place is updated (via a `PlaceQualityLibrary::recalculate(int $placeId)` call in the relevant controllers).

**New column:** `places.quality_score TINYINT UNSIGNED DEFAULT 0`

### Quality Tiers

| Score | Tier | Badge on Place Card |
|-------|------|-------------------|
| 0–39 | Stub | — |
| 40–59 | Basic | Bronze dot |
| 60–79 | Good | Silver star |
| 80–100 | Featured | Gold star |

"Featured" places are surfaced first in search results and get a distinct marker style on the Leaflet map.

## Curator XP

### Mechanic

When a place crosses a quality tier threshold, all users who contributed to it (added it, uploaded photos, edited it) receive a one-time **Curator Bonus**:

| Tier Reached | Curator Bonus XP |
|-------------|-----------------|
| Basic (40) | +10 XP |
| Good (60) | +25 XP |
| Featured (80) | +75 XP |

Additionally, if a "Featured" place receives a new rating or photo, the original place creator earns +1 XP passively (capped at +50/month per place to prevent abuse).

### Curator Rank

Users whose contributed places average a high quality score earn a **Curator Rank** displayed on their profile:

| Avg Quality of Contributed Places | Rank |
|----------------------------------|------|
| < 40 | — |
| 40–59 | Bronze Curator |
| 60–74 | Silver Curator |
| 75–84 | Gold Curator |
| 85+ | Master Curator |

The rank is recalculated nightly by a Spark command.

## Server Design

**`PlaceQualityLibrary.php`**
- `recalculate(int $placeId): int` — compute and persist `quality_score`; return new score.
- `notifyTierChange(int $placeId, int $oldScore, int $newScore)` — detect tier crossing, distribute Curator Bonus XP.

**Schema additions**
```sql
-- places table
quality_score TINYINT UNSIGNED DEFAULT 0

-- curator_bonuses (audit log to prevent double-awarding)
id, user_id, place_id, tier, awarded_at
```

## Client Design

- **Place cards and map markers**: quality tier badge (bronze/silver/gold star) overlaid on the thumbnail.
- **Place detail page**: quality score bar with breakdown (what's missing to reach the next tier).
- **User profile**: Curator Rank badge + "contributed to X Featured places" stat.
- **Search/filter**: option to filter places by quality tier.

## Why It Fits

The current XP model rewards volume. This feature adds a quality dimension without changing existing earning mechanics — it layers on top. It also aligns platform incentives: users are rewarded for making places *good*, which improves the product for all visitors, not just contributors.
