# Feature: Place Quality Score & Curator Rank

> **Status: not started**

## Overview

Make XP quality-aware. Places get a **Quality Score** from completeness and community reception; contributors to high-quality places earn **Curator XP** — rewarding stewardship, not just being first. (Not to be confused with the existing `curator` achievement, which counts edits.)

## Place Quality Score

`places.quality_score TINYINT UNSIGNED DEFAULT 0` (0–100), recalculated by `PlaceQualityLibrary::recalculate(string $placeId)` whenever the place, its photos or ratings change.

| Signal | Points |
|--------|--------|
| Description > 100 chars | +15 |
| Cover photo | +10 |
| 3+ photos | +15 |
| Rated 5+ times | +20 |
| Average rating ≥ 4.0 | +15 |
| Edited after creation | +10 |
| Has a verified visit (`users_visited_places.verified`) | +15 |

### Quality Tiers

| Score | Tier | Badge on Place Card |
|-------|------|-------------------|
| 0–39 | Stub | — |
| 40–59 | Basic | Bronze dot |
| 60–79 | Good | Silver star |
| 80–100 | Featured | Gold star |

"Featured" places rank higher in search and get a distinct map marker.

## Curator XP

When a place crosses a tier threshold, everyone who contributed (author, photo uploaders, editors) gets a one-time bonus: Basic +10, Good +25, Featured +75 XP. A Featured place's author also earns +1 XP per new rating/photo (cap +50/month per place).

Audit table to prevent double awards:
```sql
curator_bonuses: id, user_id, place_id, tier, awarded_at
```

## Curator Rank

Average quality of the user's contributed places, recalculated nightly by a Spark command:

| Avg Quality | Rank |
|-------------|------|
| < 40 | — |
| 40–59 | Bronze Curator |
| 60–74 | Silver Curator |
| 75–84 | Gold Curator |
| 85+ | Master Curator |

## Client

- Quality tier badge on `PlaceCard` and map markers.
- Place page: quality bar with "what's missing for the next tier".
- Profile: Curator Rank + "contributed to X Featured places".
- `/places` filter by quality tier.
