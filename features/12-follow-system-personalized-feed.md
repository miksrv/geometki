# Feature: Follow System & Personalized Activity Feed

## Overview

Users can follow other explorers. The home activity feed shifts from a global firehose to a personalized social graph: activity from people you follow + nearby events. When someone follows you, you get a notification. Follower/following counts appear on profiles. This is the single most important social feature — named, followed people create the accountability and curiosity loop that turns occasional visitors into daily users.

**Effort:** Medium (4–6 days backend + 3–4 days frontend)
**Impact:** Very High — directly addresses Problem 7 ("No social gravity") from the roadmap
**Phase:** 2

---

## Core Problem It Solves

The activity feed today is impersonal. "Someone somewhere rated a place" creates no emotional response. "Alex, who you follow, just captured a ghost place 1.5 km from you" creates curiosity, accountability, and the desire to compete. Without a follow graph, the community remains abstract. Abstract communities don't pull users back; named people do.

---

## How It Works

### Following Mechanics

- Any authenticated user can follow any other user with one tap.
- Following is one-directional (like Twitter, not mutual like Facebook).
- You can unfollow at any time. No notification is sent on unfollow.
- When someone follows you, you receive an in-app notification + optional email.
- Your follower count and following count are visible on your public profile.
- Suggested follows: when a new user registers, suggest 3–5 most active users in their city (derived from IP geolocation on signup).

### Personalized Feed

The home page activity feed gets a **toggle**:

| Mode | Content |
|------|---------|
| **Following** | Activity from users you follow + activity within 5 km of your last known location |
| **Global** | Current behavior — all community activity, reverse-chronological |

The "Following" tab is the default for users who follow 3+ people. For new users with fewer than 3 follows, the Global feed is shown with a persistent nudge: *"Follow 3 explorers to unlock your personalized feed."*

### Feed Item Types (Following tab)

All existing activity types are supported in the personalized feed:
- User created a new place
- User uploaded photos to a place
- User captured a ghost place
- User earned an achievement badge
- User reached a new level
- User is on a streak milestone (7, 14, 30, 60 days)

Additionally, these **social graph events** appear only in the Following feed:
- "Alex started following you"
- "Alex and 2 others are exploring [neighborhood] near you" (proximity cluster)

### Nearby Activity Layer

Regardless of follow status, the "Following" feed includes a **"Near You"** section at the top: the 3 most recent activities that happened within 5 km of the user's last known location. This gives new users (with zero follows) immediate local relevance and a reason to engage with the feed.

---

## Server Design

### New Table: `users_follows`

```sql
CREATE TABLE users_follows (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    follower_id INT UNSIGNED NOT NULL,
    following_id INT UNSIGNED NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_follow (follower_id, following_id),
    KEY idx_follower (follower_id),
    KEY idx_following (following_id),
    FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### New API Endpoints

**`POST /users/{id}/follow`**
- Auth required.
- Cannot follow yourself (400).
- Idempotent: following an already-followed user returns 200 with no side effects.
- On success: creates `users_follows` row, sends notification to the followed user, awards +2 XP to follower (encourages social exploration).

**`DELETE /users/{id}/follow`**
- Auth required.
- Removes the follow row silently.

**`GET /users/{id}/followers`**
Returns paginated list of users following `{id}`. Each item: `{ id, name, avatar, level, current_streak }`.

**`GET /users/{id}/following`**
Returns paginated list of users `{id}` is following. Same shape.

**`GET /users/me/suggestions`**
Returns 5 suggested users to follow: most active in the authenticated user's city (by `activity.created_at` in last 30 days), excluding already-followed users.

### Modified: `GET /activity`

New optional query param: `?filter=following`

When `filter=following` and the user is authenticated:
```sql
WHERE activity.user_id IN (
    SELECT following_id FROM users_follows WHERE follower_id = :current_user_id
)
OR (
    places.lat BETWEEN :lat_min AND :lat_max
    AND places.lon BETWEEN :lon_min AND :lon_max
)
ORDER BY activity.created_at DESC
LIMIT 20
```

The spatial bounds are derived from the user's last known location (stored as `users.last_lat`, `users.last_lon` — new columns, updated on any authenticated API request from a client that sends geolocation).

### Modified: `GET /users/{id}` (profile endpoint)

Add to response:
```json
{
  "followers_count": 42,
  "following_count": 17,
  "is_following": true   // only present when request is authenticated
}
```

### `FollowController.php`

```php
class FollowController extends BaseController
{
    public function follow(int $userId): ResponseInterface
    {
        // Validate: not self, not already following
        // Insert into users_follows
        // Push notification to $userId via NotificationLibrary
        // Award XP to authenticated user via ActivityLibrary::push('follow_user', ...)
        // Return 200 with updated follower count
    }

    public function unfollow(int $userId): ResponseInterface { ... }
    public function followers(int $userId): ResponseInterface { ... }
    public function following(int $userId): ResponseInterface { ... }
    public function suggestions(): ResponseInterface { ... }
}
```

---

## Client Design

### User Profile Page (`/users/[name]`)

Below the existing stats row, add:

```
[42 Followers]  [17 Following]  [ Follow ▾ ] ← button
```

- **Follow button states:** "Follow" (default), "Following ✓" (already following, hover shows "Unfollow"), loading spinner.
- Clicking the follower/following counts opens a modal with a paginated list of users (avatar + name + level).
- The follow button is hidden on your own profile.

### Home Page Feed (`/`)

Add a **tab bar** above the activity list:

```
[🌍 Global]  [👥 Following]
```

- Tab state is persisted in `localStorage`.
- "Following" tab shows a nudge banner if the user follows fewer than 3 people: *"Follow explorers to personalize this feed"* with a "Find people" link to `/users`.
- Feed items in the Following tab show the user's avatar more prominently (since the social relationship matters).

### Notifications

New notification type `new_follower`:
- In-app: "Alex started following you" with avatar and a "Follow back" CTA.
- Email: subject "Alex is now following you on Geometki" — include Alex's profile summary (level, recent places).

### Users List Page (`/users`)

- Add a **"Suggested for you"** section at the top (rendered for authenticated users only) showing 3 cards with a "Follow" button inline.
- Add a "Following" filter tab to show only users you follow.

### RTK Query Integration

New endpoints in `api/api.ts`:
```typescript
followUser: builder.mutation<void, number>({
    query: (userId) => ({ url: `/users/${userId}/follow`, method: 'POST' }),
    invalidatesTags: (_, __, userId) => [{ type: 'User', id: userId }, 'ActivityFeed'],
}),
unfollowUser: builder.mutation<void, number>({
    query: (userId) => ({ url: `/users/${userId}/follow`, method: 'DELETE' }),
    invalidatesTags: (_, __, userId) => [{ type: 'User', id: userId }, 'ActivityFeed'],
}),
getFollowers: builder.query<UserList, { userId: number; page: number }>({ ... }),
getFollowing: builder.query<UserList, { userId: number; page: number }>({ ... }),
getSuggestedUsers: builder.query<User[], void>({ ... }),
```

---

## Anti-Abuse

- Follow rate limit: max 50 new follows per hour per user (prevents bot follow-farming).
- Block list: if user A blocks user B (future feature), A disappears from B's suggestions and B's follows of A are silently removed.
- Notification throttling: max 5 "new follower" email notifications per day (batched if more arrive).

---

## Metrics to Track

- **Follow conversion rate:** % of profile visits that result in a follow
- **Feed toggle usage:** % of active users who switch to "Following" tab within 7 days of following their first user
- **Session depth for Following tab users vs. Global:** following feed users should show 20%+ higher session duration
- **D7 retention delta:** users who follow 3+ people in their first week vs. those who don't

---

## Implementation Order

1. Backend: `users_follows` table + follow/unfollow endpoints + profile count fields
2. Backend: activity feed `?filter=following` query modifier
3. Frontend: Follow button on profile + follower/following modal
4. Frontend: Feed tab bar + Following feed rendering
5. Backend: Suggested users endpoint
6. Frontend: Suggested users on `/users` page and feed nudge banner
