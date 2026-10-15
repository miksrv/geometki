# Feature 16 — Weekly Digest Additions & More Push Triggers

> Status: open part only. The weekly digest (`DigestService`, `php spark digest:weekly`) and web push
> (see CLAUDE.md, "Push") are built.

## Digest additions

Possible now:

- **"What to do this week"** (2–3 prompts by priority): unexplored places near the user
  (open `osm_candidates` of the `known` / `explore` tiers), then "rate N more places".
- **Community highlights:** places created from the "Places to explore" layer this week
  (`osm_candidates.place_id`).
- **Re-engagement version** for users inactive 14+ days: a single-focus "what happened near you"
  email with one call to action. Today inactive users with no activity on their places are
  skipped entirely.

Each needs its feature first:

- Streak section and streak-expiry prompt (`03-activity-streaks.md`).
- Freshness alerts (`15-dynamic-place-freshness-badges.md`).
- Rank changes (`13-regional-leaderboards.md`).
- New followers (`12-follow-system-personalized-feed.md`).
- Active challenge progress (`02-daily-weekly-challenges.md`).

## More push triggers

| Push | Trigger |
|---|---|
| Unexplored place nearby | `osm:collect` adds a candidate within ~1 km of the user's last location |
| Place trending | your place gets 20+ views in a week |
| Streak expiry, rank overtaken, new follower, freshness drop | once features 03 / 13 / 12 / 15 exist |
