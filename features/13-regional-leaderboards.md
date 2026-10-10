# Feature: Regional Leaderboards

> Status: not implemented.

Ranked lists of users by contribution within a location (locality, region, country). "Level 14" has
no social context; "#3 in Saint Petersburg, and Anna is catching up" does. It also gives high-level
users a competition axis that never saturates.

## Scopes

Leaderboards use the existing location hierarchy of places (`country` / `region` / `district` /
`locality`, with slugs from `location_slugs`). Start with locality and country; add region and
district if useful. A user ranks in every location where they have places; a leaderboard is shown
only when 5+ users have places in that location.

## Score

```
score = places_created * 10
      + photos_uploaded * 3
      + places_edited * 5
      + ratings_given * 2
      + places_created_from_osm_candidates * 15   -- the "Places to explore" layer
```

counted over places in the location. Recalculated nightly. Score decays 5% per month without
activity in that location, so old leaders don't stay entrenched. Ties: more places first, then
the older account.

## Server

- Table `leaderboard_scores`: `user_id` (`VARCHAR(15)`), `location_type`, `location_id`, `score`,
  `rank`, `rank_prev`, `updated_at`; index on `(location_type, location_id)`.
- Command `leaderboard:refresh` (nightly): compute scores, upsert, assign ranks, apply decay,
  queue rank-change notifications.
- `GET /leaderboard?type=&location=&page=&aroundMe=1`: top 20, or 5 above / 5 below the current
  user; includes `myRank`, `myScore`, `totalParticipants`.
- `GET /users/{id}/ranks`: all of a user's ranks, for the profile.
- Rank-change notification (in-app) when rank moves by 5+ or the user enters/leaves the top 10;
  at most one per location per 24 h.
- Users can opt out in settings: their row is hidden but still counts for others' ranks.

## Client

- `/leaderboard` page: scope tabs, location selector, "you are #47 — top 15%" card, list with rank
  delta arrows, avatar, level, score (breakdown on hover). For users outside the top 20 the
  default view is "around me".
- Profile: "Rankings" block (location, rank, delta), each row opens the leaderboard at the user.
- Optional: "Local champions" (top 3) for the visible map area; leaderboard links on location
  landing pages.
- Possible achievements: appear in any leaderboard, top 10 / #1 in a locality.
