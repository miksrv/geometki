# Feature 16 — Weekly Digest Additions & Web Push Notifications

> Status: open part only. Done: weekly email digest (`php spark digest:weekly`,
> `DigestService`, `Views/email_digest.php`, one-click unsubscribe via `settings.emailDigest`)
> with the week summary, activity on the user's places and community highlights.

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

## Web push notifications

Web only (there is no mobile app).

- Storage: Web Push API with a service worker; the subscription JSON goes in a new
  `users.web_push_subscription` column (or a table, for several devices). Cleared on logout.
- When to ask: after the user's first meaningful action (place, rating, photo), never on signup.
  Show a banner under the header with "Enable" / "Maybe later" (re-show after 7 days) /
  "Never" (`localStorage` flag).
- Dispatch: every existing in-app notification goes through a dispatcher. It also sends a push
  when the type is push-eligible, the user enabled it, and it is not quiet hours
  (22:00–08:00 local).
- Settings: per-type push toggles next to the existing email toggles in `/users/settings`.
  "Place trending" is off by default.

| Push | Trigger |
|---|---|
| Comment, rating, photo, visit or bookmark on your place | same events as the existing email notifications |
| Achievement unlocked / level up | immediately |
| Unexplored place nearby | `osm:collect` adds a candidate within ~1 km of the user's last location |
| Place trending | your place gets 20+ views in a week |
| Streak expiry, rank overtaken, new follower, freshness drop | once features 03 / 13 / 12 / 15 exist |
