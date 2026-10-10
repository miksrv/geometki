# Feature: Dynamic Place Freshness Badges

> Status: not implemented.

Every place shows a quality/freshness tier. Tiers decay if the place isn't maintained, and a drop
notifies the author, turning place creation from a one-time act into a long-term investment.
For explorers the badge answers "is this information current?".

## Tiers

| Tier | Criteria |
|------|----------|
| **Stub** | title only |
| **Draft** | description OR 1 photo |
| **Complete** | description AND 2+ photos AND 1+ tag |
| **Verified** | Complete + updated within 6 months + 3+ ratings |
| **Exemplary** | Verified + 5+ photos + 10+ ratings + updated within 3 months |

## Score

```
base_score (0–100) =
    (has_description ? 15 : 0) + (description_length > 200 ? 10 : 0)
  + min(photos, 5) * 5 + min(tags, 5) * 3 + min(ratings, 10) * 2
  + (avg_rating >= 4.0 ? 10 : 0) + (has_cover ? 5 : 0)

multiplier by days since last meaningful update: <=90 → 1.0, <=180 → 0.85, <=365 → 0.7, else 0.5
final = base_score * multiplier

Exemplary: final >= 85 AND days <= 90
Verified:  final >= 60 AND days <= 180
Complete:  final >= 35;  Draft: final >= 10;  else Stub
```

The date caps on Exemplary/Verified are hard: perfect content not updated for 7 months is not
Verified.

**Meaningful update** (resets the clock): description edit changing more than 20 characters, new
photo, cover change, new tag, a comment by the author, or a "Я здесь был" visit by the author.
Ratings, comments, visits and bookmarks by other users don't reset it.

Existing places start with `last_meaningful_update = updated_at`, so there is no retroactive
penalty.

## Server

- `places`: `freshness_score`, `freshness_tier` enum, `last_meaningful_update`, indexed.
- `FreshnessLibrary::markMeaningfulUpdate()` called from place edit, photo upload, cover change,
  author comment, author visit; recalculation also on photo deletion.
- Nightly command: recalculate decaying places, send a warning 7 days before an Exemplary place
  hits the 90-day cliff (max one per place per quarter).
- On a tier drop: in-app notification to the author (and email per settings).
- API: `freshnessTier`, `freshnessScore`, `lastMeaningfulUpdate` on places; `GET /places` filter
  `?freshness=verified` / `?freshness=stub,draft`; author's "needs attention" filter.
- Weekly digest section "places that need attention" for users with 10+ places
  (`server/app/Libraries/DigestService.php`).

## Client

- `FreshnessBadge` (`sm` icon on place cards and map popups, `lg` with "updated 3 months ago" on
  the place page). Follow `client/DESIGN.md` (one `PlaceCard`, variants for layout).
- Profile (`/users/[id]/places`): tier distribution and a "Needs attention" filter with inline
  "Update" links.
- Places/map filter: All / Verified+ / Complete+ / Stubs only (stubs = places to improve).
