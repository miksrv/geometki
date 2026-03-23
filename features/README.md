# Feature Proposals

This directory documents proposed features for Geometki. The existing system already provides XP earning (6 action types), 30 levels, reputation from place ratings, and a partial achievements schema.

## Proposals

| # | Feature | Effort | Impact | Builds On |
|---|---------|--------|--------|-----------|
| [01](./01-achievements-badges.md) | **Achievements & Badges** | Medium | High | Existing DB schema, partial implementation |
| [02](./02-daily-weekly-challenges.md) | **Daily & Weekly Challenges** | Medium | High | `ActivityLibrary::push()` hook |
| [03](./03-activity-streaks.md) | **Activity Streaks** | Low | High | `activity` table timestamps |
| [04](./04-territory-ownership.md) | **Territory Ownership** | High | High | Geocoder + coordinates data |
| [05](./05-place-quality-curator-rank.md) | **Place Quality Score & Curator Rank** | Medium | Medium | Place model, existing photo/rating flow |
| [06](./06-seasonal-events.md) | **Seasonal Events & Campaigns** | Medium | Medium | `ActivityLibrary::push()` hook |
| [07](./07-social-kudos-endorsements.md) | **Social Kudos & Peer Endorsements** | Low | Medium | Reputation field, notifications |
| [08](./08-tags-page-redesign.md) | **Tags Page Redesign** | Low–Medium | High | Existing tag list API + unused search endpoint |
| [09](./09-categories-page-redesign.md) | **Categories Page Redesign** | Low–Medium | High | Existing category list API + category images |
| [10](./10-trending-and-recommendations.md) | **Trending Places & Personalized Recommendations** ✅ | Low–Medium | High | `views` counter, `rating`/`bookmarks`/`comments` fields |

## Recommended Implementation Order

**Phase 1 — Quick wins (low effort, high return)**
1. **Streaks** (03) — two DB columns, one check in `ActivityLibrary`. Immediately drives daily retention.
2. **Achievements** (01) — schema exists; needs evaluation logic and API endpoints only.
3. **Kudos** (07) — one new table, one controller. Adds social layer with minimal backend work.

**Phase 2 — Engagement depth**
4. **Daily/Weekly Challenges** (02) — requires a cron job and new tables but hooks cleanly into existing XP flow.
5. **Place Quality Score** (05) — improves content quality organically; useful for search ranking too.

**Phase 3 — Differentiated features**
6. **Seasonal Events** (06) — community events that drive spikes in acquisition and PR.
7. **Territory Ownership** (04) — most complex but the most uniquely geo-native feature; strongest competitive differentiator.
