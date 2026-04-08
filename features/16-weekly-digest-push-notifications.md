# Feature: Weekly Personal Digest & Smart Push Notifications

## Status

| Part | Status | Notes |
|------|--------|-------|
| Part 1: Weekly Email Digest (core) | `🚧 IN PROGRESS` | QW3 sprint — sections on available data |
| Part 1: Streak / Rank / Freshness / Followers sections | `⏳ PENDING` | Blocked on Features 1.1, 13, 15, follow system |
| Part 2: Smart Push Notifications | `⏳ PENDING` | Blocked on mobile push token infra + web push |

---

## Overview

Two complementary re-engagement systems: (1) a weekly Monday email digest that summarizes "what happened in your world" — XP earned, places viewed, rank changes, followers gained, and personalized action prompts; (2) a smart push notification layer (mobile + web) that sends timely, contextually relevant triggers — streak expiry warnings, challenge reminders, rank overtake alerts, and ghost place spawn notifications.

**Effort:** Medium (4–5 days backend + 2 days frontend for notification preferences UI)
**Impact:** Very High — re-engages dormant users (who would never think to re-open the app) and converts active users into daily habits
**Phase:** 1 (weekly digest is a quick win; push infrastructure is Phase 1–2)

---

## Core Problem It Solves

The app never calls out to the user. The only proactive communication today is a real-time email when someone rates or comments on your place — a passive, other-user-dependent trigger. This means:
- Users who haven't been active for a week receive zero prompts.
- There is no signal for "something changed in your world" — no streak warning, no rank overtake, no ghost place spawn.
- Users who go cold stay cold because nothing reaches them.

The weekly digest and push notifications together answer: *"What is waiting for you? Why should you open the app today?"*

---

## Part 1: Weekly Email Digest

### Sending Schedule

Every Monday at 09:00 local time (approximated from the user's city timezone, derived from their places' coordinates). First digest is sent on the Monday after a user completes their first action (not on signup day — wait until they've done something worth summarizing).

### Digest Sections

The digest is fully personalized — every section is conditional and only renders if the data is non-trivial.

---

#### Section 1: Your week at a glance `[✅ IMPLEMENT NOW]`

> Data source: `activity` table (types: place, photo, rating, edit) + `users.experience` delta via `users_levels`.

Always shown if user was active this week:

```
This week you:
  ✓ Earned 340 XP  (×1.25 streak multiplier — you're on 9 days!)
  ✓ Created 2 new places
  ✓ Uploaded 7 photos
  ✓ Rated 5 places
```

If user was inactive this week, this section is replaced by a gentle return prompt (see below).

---

#### Section 2: Your streak `[⏳ PENDING — blocked on Feature 1.1 (activity streaks)]`

Shown if user has an active streak of 3+ days:

```
🔥 9-day streak
You're one tier away from the ×1.5 XP multiplier (14 days).
Keep it going this week — one action is enough each day.
```

Shown if user had a streak that broke this week:
```
Your 6-day streak ended last Thursday.
Start a new one today — streaks begin with one action.
[Open Geometki →]
```

---

#### Section 3: Your places this week `[✅ IMPLEMENT NOW]`

> Data source: JOIN `activity → places` (ratings/comments/photos/edits by others) + `places_views_log` (weekly view counts). Top 10 places per user sorted by engagement score (ratings×5 + comments×4 + photos×3 + edits×2 + min(views,50)×1).

Shown if any of the user's places received activity:

```
Your places were busy this week:

  📍 Café Pushkin          ★★★★☆  2 new ratings, 34 views
  📍 Street Art on Arbat   12 views, 1 new photo added
  📍 Bookshop Falanster    1 new bookmark

[See all your places →]
```

If a place received 20+ views: highlighted with a "trending" label.

---

#### Section 4: Freshness alerts `[⏳ PENDING — blocked on Feature 15 (freshness tiers)]`

Shown if any of the user's places degraded in freshness tier (Feature 15):

```
⚠️  3 of your places need attention:

  → Café Pushkin (Verified → Complete)    last updated 7 months ago
  → The Old Library (Complete → Draft)    last updated 11 months ago
  → Wall Mural on Lenina (Stub)           never had a description

One update each is enough to restore their badge.
[Update your places →]
```

---

#### Section 5: Your rank changes `[⏳ PENDING — blocked on Feature 13 (territory/leaderboard)]`

Shown if user's leaderboard rank changed by ±3 or more this week (Feature 13):

```
📊 Your rank in Moscow: #12  ↑3 this week

You need 180 more points to reach the top 10.
Anna (#11) has 1,420 points — you're at 1,240.
```

---

#### Section 6: New followers `[⏳ PENDING — blocked on follow system (no followers table yet)]`

Shown if user gained followers this week:

```
👥 3 people followed you this week:
  [Avatar] Alex K. · Level 14 · 67 places
  [Avatar] Maria S. · Level 9 · 23 places
  [Avatar] Dmitri P. · Level 21 · 145 places

[See who's following you →]
```

---

#### Section 7: What to do this week `[⚠️ PARTIAL — only generic prompts available now]`

> Currently implementable: prompt to rate more places (activity data available). All other prompts blocked on missing features (streaks, ghost places, challenges, rank system).

Always shown — 2–3 personalized action prompts based on user's current state:

```
This week you could:

  📋 Complete your 3-day challenge streak to earn the ×1.1 multiplier
  📍 5 ghost places appeared near you this week — be the first to capture them
  ⭐ Rate 3 more places to finish this week's challenge (+90 XP)
```

Prompts are selected from a priority list:
1. Streak expiry warning (if streak ≥ 3 and not yet active today/this week)
2. Ghost places near user (Feature 11)
3. Active challenge with incomplete progress (Feature 02)
4. Freshness alerts for creator's places
5. Rank opportunity ("you're 45 pts from top 10")
6. New users to follow in local area

---

#### Section 8: Community highlights `[✅ IMPLEMENT NOW]`

> Data source: `activity` table (new places count this week) + `users_levels` (who levelled up). Ghost place captures and seasonal events omitted until those systems exist.

Always shown — keeps the digest interesting even for inactive users:

```
🗺️  In Moscow this week:
  → 23 new places added
  → Ghost place "Дом Пашкова" captured for the first time
  → Anna K. reached Level 25
  → March photo challenge: "Abandoned Buildings" — voting opens tomorrow
```

---

#### Re-engagement version (for inactive users)

If the user has been inactive for 2+ weeks, the digest is simplified to a single-focus "we miss you" message:

```
Subject: 5 things happened near you while you were away

Hey [Name],

Here's what happened in Moscow since you last visited Geometki:

  📍 34 new places added near you
  👥 2 explorers you know reached new levels
  🏠 A ghost place appeared 400m from your home pin — no one has captured it yet
  ⭐ Your place "Café Pushkin" got 12 new ratings this week

Your 6-day streak from last month? Start a new one with one action today.
[Open Geometki →]
```

The goal of the re-engagement version is a single click, not information density.

---

### Email Infrastructure `[✅ IMPLEMENT NOW]`

**Template engine:** Use the existing email infrastructure (CodeIgniter 4 email service + existing HTML templates).

**New service class: `DigestService.php`** `[✅ IMPLEMENT NOW]`

**Algorithm — activity-driven (not user-driven):**

Instead of iterating all users and querying their places, the pipeline reads from the data side:

1. **`buildPlaceActivitySection`** — JOINs `activity → places` to find all place_id entries with activity this week, groups by owner (`places.user_id`). Merges with weekly views from `places_views_log`. Returns top 10 places per user sorted by engagement score.
2. **`WeeklyDigestCommand`** — pre-fetches the set of `user_id`s that actually have data this week (via one UNION query on activity + places_views_log), then loads only those users for digest generation. Never iterates inactive users with no data.

```php
// places_views_log schema: (place_id, view_date DATE, count INT)
// Used for weekly view totals per place

class DigestService
{
    // Section data structure for place_activity:
    // [
    //   ['place_id' => '...', 'ratings' => N, 'comments' => N,
    //    'photos' => N, 'edits' => N, 'views' => N],
    //   ... up to 10 entries, sorted by engagement score
    // ]
}
```

**Cron job: `WeeklyDigestCommand.php`** `[✅ IMPLEMENT NOW]`

Runs every Monday at 01:00 UTC.
```
1. UNION query on (activity JOIN places) + (places_views_log JOIN places)
   → get distinct user_ids that have data this week
2. Load only those users where email_digest_enabled = 1
3. For each user: DigestService::generateForUser() → render → insert into sending_mail
4. Update users.digest_sent_at
```

### Unsubscribe

Every digest email has a one-click unsubscribe link. Clicking it sets `users.email_digest_enabled = 0`. No confirmation screen — immediate, irreversible (reversible only via profile settings).

---

## Part 2: Smart Push Notifications `[⏳ PENDING — entire part blocked]`

### Notification Types and Triggers

| Notification | Trigger | Timing | Channel |
|-------------|---------|--------|---------|
| Streak expiry | User has streak ≥ 3 AND no activity today | 20:00 local time daily | Push + optionally email |
| Challenge deadline | Active challenge, user hasn't completed it, 4 hours left | 4h before midnight | Push only |
| Rank overtaken | Nightly cron detects rank drop of ±1 in top 20 | 08:00 next morning | Push + in-app |
| Ghost place spawned | Overpass cron creates new ghost places within 1km | Within 1h of spawn | Push only |
| New follower | Someone follows you | Immediately | Push + in-app |
| Place trending | Your place hits 20+ views this week | Thursday 18:00 | Push + in-app |
| Freshness decay | Your place dropped a tier | Monday morning | In-app + weekly digest |
| Level up | XP threshold crossed | Immediately | Push + in-app modal |
| Achievement unlocked | Achievement condition met | Immediately | Push + in-app modal |

### Push Token Management

**Mobile (Expo):**
- Expo push notification token stored on `users.expo_push_token` (new column).
- Token is registered/updated on app launch via `POST /users/me/push-token`.
- Token is cleared on logout.

**Web:**
- Web Push API (service worker-based). Push subscription JSON stored in `users.web_push_subscription` (new TEXT column).
- Subscription is requested after the user completes their first action (not on signup — avoid the "allow notifications before I know what this is" rejection).
- Prompt: "Stay on top of your streak and rank changes. Enable notifications?" → Accept → subscribe.

### Server: `NotificationDispatcher.php`

Extends the existing `NotificationLibrary`:

```php
class NotificationDispatcher
{
    public function dispatch(int $userId, string $type, array $data): void
    {
        $user = UserModel::find($userId);

        // 1. Always create in-app notification (existing behavior)
        NotificationLibrary::push($userId, $type, $data);

        // 2. Push notification if type is push-eligible and user has token
        if ($this->isPushEligible($type, $user) && $user->expo_push_token) {
            ExpoNotificationService::send($user->expo_push_token, $this->renderPush($type, $data));
        }

        // 3. Web push if subscribed
        if ($this->isPushEligible($type, $user) && $user->web_push_subscription) {
            WebPushService::send($user->web_push_subscription, $this->renderPush($type, $data));
        }
    }

    private function isPushEligible(string $type, User $user): bool
    {
        // Check user preferences + quiet hours (22:00–08:00 local time)
        return $user->push_notifications_enabled
            && !$this->isQuietHour($user)
            && $this->userWantsPushFor($type, $user);
    }
}
```

### Notification Preferences

New user settings page section — **"Notifications"**:

```
Email
  ✓ Weekly digest (every Monday)
  ✓ New follower
  ✓ Rating or comment on your places
  ✓ Achievement unlocked

Push notifications
  ✓ Streak expiry warning
  ✓ Daily challenge reminder
  ✓ Rank changes
  ✓ Ghost places near you
  ✓ New follower
  ✗ Place trending (off by default — can be noisy)
```

Each toggle maps to a boolean column in the `users` table. Defaults are aggressive (most on) but easily adjustable.

---

## Client Design

### Notification Preferences Page (`/users/settings/notifications`)

Simple toggle list grouped by category (Email / Push). Each toggle calls `PATCH /users/me/settings` with the changed preference key.

### Web Push Permission Prompt

A non-intrusive banner shown after a user's first meaningful action (place created, first rating, first photo), positioned below the page header:

```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Get notified about your streak and rank changes      │
│ [Enable notifications]  [Maybe later]  [Never]          │
└─────────────────────────────────────────────────────────┘
```

"Never" stores a `localStorage` flag and never shows the prompt again. "Maybe later" re-shows after 7 days.

### In-App Notification Bell

The existing notification bell in the header. No changes needed for the bell itself — it already shows in-app notifications. The push system is a separate delivery channel for the same notification types.

---

## Privacy and Compliance

- **GDPR:** Weekly digest is opt-out (not opt-in) for EU users since it contains only data the user has generated themselves. Unsubscribe is one-click.
- **Data retention:** Notification send logs are purged after 90 days.
- **No third-party tracking pixels in emails.** Open rates tracked via a 1px server-hosted image only. Click tracking via redirect through the Geometki server (not a third-party service).
- **Quiet hours:** Push notifications are never sent between 22:00 and 08:00 local time. The streak expiry warning uses 20:00 specifically to give the user 4 hours to act before a common bedtime.

---

## Metrics to Track

- **Digest open rate:** target > 30% (industry average for engagement emails is 20–25%)
- **Click-through rate from digest:** which sections generate the most return visits?
- **Push opt-in rate:** % of web users who enable push after seeing the prompt
- **D7 retention: digest users vs. non-digest users:** strong proxy for the system's core value
- **Streak save rate after expiry notification:** % of users who receive the warning and perform an action the same day
- **Unsubscribe rate:** should stay below 2% per month; spikes indicate bad targeting or frequency
