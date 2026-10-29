# Feature: Regional Leaderboards & Champions

> Status: not implemented. The first step, the top explorers of a location (home page, location
> pages), is step 5 of `25-visits-and-exploration.md`; this spec is the full leaderboards and the
> champions after it, on the same score.

Ranked lists of users by contribution within a location (locality, region, country). "Level 14" has
no social context; "#3 in Saint Petersburg, and Anna is catching up" does. It also gives high-level
users a competition axis that never saturates. The #1 of a location is its **champion**.

## Scopes

Leaderboards use the existing location hierarchy of places (`country` / `region` / `district` /
`locality`, with slugs from `location_slugs`). Start with locality and region; add the others if
useful. A user ranks in every location where they have contributed; a leaderboard is shown only
when 5+ users have a score there.

## Score

The score of step 5 of feature 25, nothing else:

```
score = places × 10 + spots opened × 15 + visits with a contribution × 3 + photos × 2
```

counted over the places of the location, from `activity`. Two periods instead of a decay: **all
time** and **this year**, so old leaders do not stay on top of the default view. Ratings do not
count (guests rate too, and a rating costs one tap). Ties: more places first, then the older
account.

## Champions

- The #1 of "this year" in a locality or a region is its champion: "Champion of {location}" on the
  profile and next to the name in the location's leaderboard.
- A badge, not experience: no passive XP (experience is counted from the log of actions,
  `LevelsLibrary::experience()`; a bonus with no action behind it would be lost on a recount).
  Achievements are fine: "a champion of any location", "the first contributor of a location".
- On a change of champion: an in-app notification to the old one ("You've been overtaken in Kazan")
  and the new one.

## Server

- Table `leaderboard_scores`: `user_id` (`VARCHAR(15)`), `location_type`, `location_id`, `period`
  (`all` / `year`), `score`, `rank`, `rank_prev`, `updated_at`; index on
  `(location_type, location_id, period)`. Kept up to date by `ActivityLibrary` and
  `ActivityRemoval` like the reputation, `php spark leaders:rebuild` for a full recount (step 5
  starts with a read from `activity`; the table comes when that gets slow).
- `GET /leaderboard?type=&location=&period=&page=&aroundMe=1`: top 20, or 5 above / 5 below the
  current user; includes `myRank`, `myScore`, `totalParticipants`, the champion.
- `GET /users/{id}/ranks`: all of a user's ranks and championships, for the profile.
- Rank-change notification (in-app) when rank moves by 5+, the user enters/leaves the top 10 or
  loses a championship; at most one per location per 24 h.
- Users can opt out in settings: their row is hidden but still counts for others' ranks.

## Client

- `/leaderboard` page: scope tabs, location selector, period switch, "you are #47 — top 15%" card,
  list with rank delta arrows, avatar, level, score (breakdown on hover). For users outside the
  top 20 the default view is "around me".
- Profile: "Rankings" block (location, rank, delta) and the champion badges; each row opens the
  leaderboard at the user.
- Location landing pages (`/places/{location}`, behind `NEXT_PUBLIC_LANDING_LOCATIONS`): the
  champion and a link to the full leaderboard, under the step 5 block.
- Optional: "Local champions" (top 3) for the visible map area.
