# Feature Proposals

This directory documents proposed features for Geometki. The existing system already provides XP earning (6 action types), 30 levels, reputation from place ratings, and a partial achievements schema.

## Proposals

| # | Feature | Status | Effort | Impact | Builds On |
|---|---------|--------|--------|--------|-----------|
| [01](./01-achievements-badges.md) | **Achievements & Badges** | ✅ Done | Medium | High | Existing DB schema, partial implementation |
| [02](./02-daily-weekly-challenges.md) | **Daily & Weekly Challenges** | ⏳ Pending | Medium | High | `ActivityLibrary::push()` hook |
| [03](./03-activity-streaks.md) | **Activity Streaks** | ⏳ Pending | Low | High | `activity` table timestamps |
| [04](./04-territory-ownership.md) | **Territory Ownership** | ⏳ Pending | High | High | Geocoder + coordinates data |
| [05](./05-place-quality-curator-rank.md) | **Place Quality Score & Curator Rank** | ⏳ Pending | Medium | Medium | Place model, existing photo/rating flow |
| [06](./06-seasonal-events.md) | **Seasonal Events & Campaigns** | ⏳ Pending | Medium | Medium | `ActivityLibrary::push()` hook |
| [07](./07-social-kudos-endorsements.md) | **Social Kudos & Peer Endorsements** | ⏳ Pending | Low | Medium | Reputation field, notifications |
| 08 | **Tags Page Redesign** | ✅ Done | Low–Medium | High | Existing tag list API + unused search endpoint |
| [09](./09-categories-page-redesign.md) | **Categories Page Redesign** | ⏳ Pending | Low–Medium | High | Existing category list API + category images |
| 10 | **Trending Places & Personalized Recommendations** | ✅ Done | Low–Medium | High | `views` counter, `rating`/`bookmarks`/`comments` fields |
| [11](./11-overpass-ghost-places.md) | **Overpass Ghost Places & Capture Mechanic** | ⏳ Pending | Medium–High | Very High | `OverpassAPI.php`, `OverpassCategoryModel`, `SessionLibrary` coordinates |
| [12](./12-follow-system-personalized-feed.md) | **Follow System & Personalized Activity Feed** | ⏳ Pending | Medium | Very High | Activity feed, user profiles, notification system |
| [13](./13-regional-leaderboards.md) | **Regional Leaderboards & Social Competition** | ⏳ Pending | Medium | High | Place coordinates, existing XP/contribution data, cron infrastructure |
| [14](./14-photo-challenges-community-albums.md) | **Photo Challenges & Community Albums** | ⏳ Pending | High | High | Photos table, existing place/user system, notifications |
| [15](./15-dynamic-place-freshness-badges.md) | **Dynamic Place Freshness Badges** | ⏳ Pending | Medium | High | Places table, photo/rating data, cron infrastructure |
| [16](./16-weekly-digest-push-notifications.md) | **Weekly Digest & Smart Push Notifications** | ⚡ Partial | Medium | Very High | Email service, all retention features as data sources |
| [17](./17-personal-fog-of-war-explorer-map.md) | **Personal Fog of War & Explorer Map** | ⏳ Pending | Medium–High | Very High | `sessions_history` coordinates, `user_explored_tiles` (new), Leaflet heatmap layer |
| [18](./18-visited-places-checkin.md) | **Verified Visit Mechanic ("Я здесь был")** | ✅ Done | Low–Medium | Medium | `users_visited_places`, `places` table, existing visited toggle |
| [19](./19-admin-sent-emails.md) | **Admin: Sent Emails Dashboard** | ✅ Done | Low | Low | `sending_mail` table, existing mail controller, `SessionLibrary` auth |

## Recommended Implementation Order

**Phase 1 — Quick wins (low effort, high return)**
1. **Streaks** (03) — two DB columns, one check in `ActivityLibrary`. Immediately drives daily retention.
2. **Achievements** (01) — schema exists; needs evaluation logic and API endpoints only.
3. **Kudos** (07) — one new table, one controller. Adds social layer with minimal backend work.
4. **Weekly Digest** (16, Part 1) — no new features needed; queries existing data. Re-engages dormant users immediately.

**Phase 2 — Engagement depth**
5. **Daily/Weekly Challenges** (02) — requires a cron job and new tables but hooks cleanly into existing XP flow.
6. **Place Quality Score** (05) — improves content quality organically; useful for search ranking too.
7. **Follow System** (12) — the most impactful social feature; named social graph replaces the anonymous firehose.
8. **Place Freshness Badges** (15) — creates ongoing creator maintenance loop; integrates with challenges.
9. **Regional Leaderboards** (13) — adds competitive social layer; requires Feature 12 for full value.
10. **Smart Push Notifications** (16, Part 2) — proactive re-engagement; amplifies all other retention features.

**Phase 3 — Differentiated features**
11. **Seasonal Events** (06) — community events that drive spikes in acquisition and PR.
12. **Territory Ownership** (04) — most complex but the most uniquely geo-native feature; strongest competitive differentiator.
13. **Photo Challenges** (14) — creative social dimension; best SEO content generator; requires mature user base to seed voting.
14. **Fog of War** (17) — highest-engagement location mechanic; Phase 2 when sessions_history has meaningful data volume.
