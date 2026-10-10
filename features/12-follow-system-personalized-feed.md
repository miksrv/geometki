# Feature: Follow System & Personalized Activity Feed

> Status: not implemented.

Users follow other explorers (one-directional, like Twitter). The activity feed gets a personalized
"Following" mode: activity of people you follow plus activity near you. Named people you follow
create the curiosity and accountability loop that a global "someone rated a place" feed lacks.

## Mechanics

- Any authenticated user can follow any other user; unfollow at any time, silently.
- Being followed sends an in-app notification (`new_follower`, with a "Follow back" CTA) and an
  optional email (setting in `/users/settings`, batched to at most 5 per day).
- Follower and following counts are shown on the public profile.
- Suggested follows: the 3–5 most active users in the user's area (activity in the last 30 days),
  excluding those already followed.

## Personalized feed

The activity feed (home page and `/activity`) gets a tab toggle:

| Mode | Content |
|------|---------|
| **Following** | Activity of followed users + activity within 5 km of the user's last known location |
| **Global** | Current behaviour: all activity, newest first |

- "Following" is the default for users who follow 3+ people; others see Global with a nudge
  "Follow 3 explorers to unlock your personalized feed" linking to `/users`.
- A "Near you" block on top of Following: the 3 latest activities within 5 km, so users with no
  follows still get local relevance.
- The last known location is the session's `lat`/`lon` (`sessions` table), no new columns needed.

## Server

- Table `users_follows`: `follower_id`, `following_id` (both `VARCHAR(15)` like `users.id`),
  `created_at`; unique `(follower_id, following_id)`, indexes on both columns.
- Endpoints:
  - `POST /users/{id}/follow`: auth, 400 on self, idempotent; creates the notification.
  - `DELETE /users/{id}/follow`
  - `GET /users/{id}/followers`, `GET /users/{id}/following`: paginated `{ id, name, avatar, level }`.
  - `GET /users/me/suggestions`
  - `GET /activity?filter=following`: activity of followed users OR places within the 5 km box.
  - `GET /users/{id}` adds `followersCount`, `followingCount`, `isFollowing` (when authenticated).
- New activity/notification type `follow` / `new_follower` (enum migration).
- Rate limit: max 50 new follows per hour per user.

## Client

- Profile (`/users/[id]`): "N followers / N following" (open a paginated list) and a
  Follow / Following button (hover shows "Unfollow"); hidden on your own profile.
- Feed: Global / Following tabs, choice remembered in `localStorage`.
- `/users`: "Suggested for you" block for authenticated users and a "Following" filter.
- RTK Query: `followUser`, `unfollowUser` (invalidate the user and the activity feed),
  `getFollowers`, `getFollowing`, `getSuggestedUsers`.

## Implementation order

1. `users_follows`, follow/unfollow endpoints, profile counts.
2. `GET /activity?filter=following`.
3. Follow button and followers/following lists on the profile.
4. Feed tabs.
5. Suggestions endpoint and UI.
