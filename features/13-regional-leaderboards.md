# Feature: Regional Leaderboards & Social Competition

## Overview

Show ranked lists of users by contribution score within a geographic area (city, district, country). Users see where they rank among local explorers — and who they need to overtake. The leaderboard is visible on the map interface and as a standalone page. When your rank changes (up or down), you get notified. Competition between named people in the same city is one of the strongest social re-engagement mechanics possible.

**Effort:** Medium (5–7 days backend + 3–4 days frontend)
**Impact:** High — closes the competitive social loop; named rivals create recurring reasons to act
**Phase:** 2 (depends on territory ownership data from Feature 04, but can ship independently with city-level scope only)

---

## Core Problem It Solves

The current XP level system is a global, impersonal counter. "I am level 14" has no social context. "I am ranked #3 in Saint Petersburg — and Anna is catching up" is an entirely different motivational structure. The leaderboard converts individual progress into a social race with identifiable opponents and a concrete goal: *climb the list*.

This also addresses the ceiling problem for high-level users: after reaching level 30, what's left? The leaderboard gives them a new axis of competition that never saturates.

---

## Leaderboard Scopes

Three geographic scopes, each with its own ranking:

| Scope | Description | Example |
|-------|-------------|---------|
| **City** | Users whose places are primarily in one city | Top explorers in Moscow |
| **District** | Users whose places concentrate in a neighborhood | Top explorers in Arbat |
| **Country** | Nationwide ranking | Top explorers in Russia |

A user's primary city is determined by the geographic centroid of their created places (if they have fewer than 3 places, fallback to registration IP geolocation). District rank is shown only to users with 5+ places in that district.

---

## Scoring Formula

Each user's **Leaderboard Score** for a given region is calculated as:

```
leaderboard_score =
    (places_created_in_region       * 10) +
    (photos_uploaded_in_region      *  3) +
    (places_edited_in_region        *  5) +
    (ratings_given_in_region        *  2) +
    (ghost_places_captured_in_region * 15) +
    (avg_quality_score_of_places    *  2)   -- bonus for quality, not just quantity
```

Scores are recalculated nightly by a cron job. The score for city/country scope is the sum across all places the user has in that region. District scope counts only places within the district polygon.

**Decay:** Scores decay 5% per month of inactivity in the region. A user who dominated a district 2 years ago and stopped contributing gradually loses ground to active newcomers. This prevents permanent entrenchment.

---

## Server Design

### New Table: `leaderboard_scores`

```sql
CREATE TABLE leaderboard_scores (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    scope        ENUM('city', 'district', 'country') NOT NULL,
    region_slug  VARCHAR(100) NOT NULL,  -- 'moscow', 'arbat', 'russia'
    region_name  VARCHAR(200) NOT NULL,  -- human-readable
    score        INT UNSIGNED NOT NULL DEFAULT 0,
    rank         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    rank_prev    SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- previous day's rank for delta
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_scope_region (scope, region_slug),
    KEY idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Cron Job: `LeaderboardCommand.php`

Runs nightly at 02:00 UTC:

```php
// 1. For each region with active users:
//    a. Calculate score for each user with places in this region
//    b. UPSERT into leaderboard_scores
//    c. Apply rank numbers (ORDER BY score DESC)
//    d. Compare rank vs rank_prev — if changed, enqueue rank-change notification

// 2. Apply monthly decay:
//    UPDATE leaderboard_scores SET score = FLOOR(score * 0.95)
//    WHERE user_id NOT IN (
//        SELECT DISTINCT user_id FROM activity
//        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
//        AND region_slug = leaderboard_scores.region_slug
//    )
```

### New API Endpoints

**`GET /leaderboard`**

Query params:
- `scope` — `city | district | country` (default: `city`)
- `region` — region slug (default: authenticated user's primary city)
- `page` — pagination (20 per page)
- `around_me=1` — returns 5 users above and below the authenticated user instead of top-20

Response:
```json
{
  "region": { "slug": "moscow", "name": "Москва", "scope": "city" },
  "my_rank": 47,
  "my_score": 1240,
  "total_participants": 312,
  "entries": [
    {
      "rank": 1,
      "rank_delta": 0,
      "user": { "id": 12, "name": "Anna", "avatar": "...", "level": 22 },
      "score": 4820,
      "places_count": 134
    }
    ...
  ]
}
```

**`GET /users/{id}/ranks`**

Returns all leaderboard entries for a given user (all their regions and scopes). Used on the profile page.

```json
{
  "ranks": [
    { "scope": "city", "region_name": "Москва", "rank": 12, "score": 1240, "rank_delta": +3 },
    { "scope": "district", "region_name": "Арбат", "rank": 3, "score": 340, "rank_delta": -1 },
    { "scope": "country", "region_name": "Россия", "rank": 88, "score": 1240, "rank_delta": +2 }
  ]
}
```

### Rank-Change Notifications

When the nightly cron detects a rank change of ±5 or more, or when the user enters/exits the top 10:

- **Climbed:** "You moved up to #8 in Moscow! Keep exploring to reach the top 5."
- **Overtaken:** "Anna overtook you in Arbat District. She's now #2, you're #3. You're 45 points behind."
- **Entered top 10:** "You just entered the top 10 in Saint Petersburg. 🏆"

Notifications are batched: max one rank-change notification per region per 24 hours.

---

## Client Design

### Leaderboard Page (`/leaderboard`)

Full-page leaderboard with:

**Header:**
- Region selector: tabs for City / District / Country
- City dropdown (for users active in multiple cities)
- Authenticated user's rank card: "You are ranked #47 in Moscow — top 15%"

**Table / Card List:**
- Rank number (with delta arrow: ↑3, ↓1, — same)
- User avatar + name + level badge
- Score (with breakdown tooltip on hover: "134 places × 10, 42 photos × 3...")
- "Follow" button inline (if not already following)

**"Around me" toggle:**
When toggled, the list centers on the authenticated user's position in the ranking, showing ±5 users. This is the default view for users outside the top 20 — showing the global top 20 to a rank-200 user is demotivating; showing "you vs. the 5 people above and below you" is actionable.

```
#44  Ivan        1,310 pts  [Follow]
#45  Maria       1,295 pts  [Follow]
#46  → YOU       1,240 pts
#47  Dmitri      1,235 pts  [Follow]
#48  Elena       1,198 pts  [Follow]
```

**Map Integration:**
On the interactive map, a collapsible sidebar panel "Local Champions" shows the top 3 users for the currently visible region (derived from map center + zoom level). Each shows avatar + name + score. Clicking a user opens their profile.

### User Profile Page

Add a **"Rankings"** section below the stats row:

```
Rankings
──────────────────────────────
🏙️  Moscow        #12  ↑3
🏘️  Arbat District  #3  ↓1
🇷🇺  Russia         #88  ↑2
```

Clicking any row opens the full leaderboard filtered to that region, scrolled to the user's position.

### Home Page Widget (for authenticated users)

In the personalized dashboard (Feature 1.2 from roadmap), add a "Your Rank" card:

```
📊 Your Rank in Moscow
────────────────────────
#12 of 312 explorers  ↑3 this week
[View leaderboard →]
```

### RTK Query Integration

```typescript
getLeaderboard: builder.query<LeaderboardResponse, LeaderboardParams>({
    query: ({ scope, region, page, aroundMe }) =>
        `/leaderboard?scope=${scope}&region=${region}&page=${page}&around_me=${aroundMe ? 1 : 0}`,
    providesTags: ['Leaderboard'],
}),
getUserRanks: builder.query<UserRanks, number>({
    query: (userId) => `/users/${userId}/ranks`,
    providesTags: (_, __, userId) => [{ type: 'User', id: userId }],
}),
```

---

## Gamification Integration

### Leaderboard Achievements (add to Feature 01)

| Achievement | Condition |
|-------------|-----------|
| Local Scout | Appear in any city leaderboard (any rank) |
| Top 50 | Reach top 50 in your city |
| Top 10 | Reach top 10 in your city |
| District Champion | Reach #1 in any district |
| City Champion | Reach #1 in any city |
| Comeback King | Rise 20+ positions in one week |

### XP from Rank Maintenance

Users in the **top 10** of their city earn **+5 XP per day** passively (same mechanic as territory ownership Feature 04 but scoped to the leaderboard). This creates skin-in-the-game for maintaining high rank.

---

## Edge Cases

- **New city with 1 user:** Show leaderboard only when there are 5+ users with places in a region.
- **Tied scores:** Secondary sort by `places_count` DESC, then `user.created_at` ASC (earlier account wins tiebreak).
- **User deletes places:** Scores are recalculated nightly; deleted places reduce score in next cycle.
- **Privacy:** Users can opt out of leaderboards in profile settings (their row is hidden but score still calculated for others' rank computation).

---

## Metrics to Track

- **Leaderboard page visits per DAU** — proxy for competitive engagement
- **Follow rate from leaderboard** — does seeing ranked peers drive follows?
- **Return rate for users in top 50 vs. outside** — rank pressure drives return
- **Score delta per week for top-100 users** — are top users actively maintaining rank?
