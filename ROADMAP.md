# Geometki — Retention-Focused Product Roadmap

> **Document version:** 1.0
> **Date:** 2026-03-24
> **Framing:** This is a product strategy document, not a feature backlog. Every item here is justified by a specific behavioral outcome — a reason for a user to return.

---

## 1. Current State Summary

### What exists today

Geometki is a geospatial content platform. Authenticated users can:

- Create geotagged places (title, description, category, coordinates, photos)
- Browse places on an interactive map or paginated catalog with filters
- Upload photos and set cover images for places
- Rate places (1–5 stars) and leave comments
- Bookmark and mark places as visited
- View a community activity feed on the home page
- See their own profile with stats (places created, photos, ratings, edits)
- Progress through a 30-level XP system by performing any of the above actions

The platform also has: an email notification system (rating/comment/edit/photo on your places), a user directory, category browsing, tag search, OAuth authentication (Google, Yandex, VK).

Planned but not yet live: activity streaks, daily/weekly challenges, achievement badges, territory ownership, social kudos, seasonal events, Overpass ghost places.

### What the product actually does from a user perspective

A user who discovers Geometki can:

1. Sign in with Google
2. Browse existing places on a map or list
3. Create a place they know about
4. Upload a few photos
5. Check their XP and level
6. Leave

That's the full loop. It takes one session. After that, there is nothing the product actively asks the user to do or return for. The map looks the same tomorrow as it does today. Nothing in the app world changes between visits unless some other user happens to create a nearby place — an event the user has no signal for.

### Who the product implicitly targets

The current experience suits one profile: **the motivated cartographer** — someone with intrinsic drive to document places and contribute to a shared map. This is a tiny audience. These users exist, but they are rare enough that building only for them produces a platform that stagnates. Everyone else — the curious visitor, the local expert, the competitive explorer — has no reason to come back.

---

## 2. Core Problems: Why Users Don't Return

### Problem 1 — The world is static

This is the root cause of everything else. When a user closes the app, nothing changes. No new ghost places appear for them to capture. No territory shifts. No challenge resets. No streak ticks. The map will look identical in three days. **A static world gives the user no urgency and no reason to return.**

The highest-retention location apps — Pokémon GO, Geocaching, Fog of War, Strava — are all built on the concept that the world is *alive and changes without you.* Something is always happening that you might miss.

### Problem 2 — No defined user goal

The XP and 30-level system exists, but it answers the wrong question. It answers *how do I progress?* but not *what am I progressing toward?* There is no telos — no tangible thing a level-20 user has that a level-1 user doesn't, beyond a higher number and a different avatar frame. The level system is a scoreboard with no game attached.

Users need a *mission*: "Explore your city," "Capture unclaimed places," "Become the district champion." Without a mission, the activity feels arbitrary and the progression feels hollow.

### Problem 3 — No trigger to return

The only things that bring a user back today are:

- An email notification that someone rated or commented on their place (passive, depends on other users)
- Intrinsic curiosity to check the feed (weak, erodes fast)

There is no proactive, system-generated trigger that says: *"Something is waiting for you. Come back today."* No streak expiring. No daily challenge refreshing. No territory changing hands. No ghost place that spawned 800 meters from where the user lives. **The app never calls out to the user.**

### Problem 4 — The contribution has no ongoing value

When a user creates a place, that place goes into the system and mostly sits there. The user can see how many views it got, but views are a vanity number with no consequence. There's no mechanism where the *quality or ongoing attention* given to a place benefits its creator in a recurring way. You do the work once, and the payoff is immediate and final. **Once-off rewards don't build habits.**

Compare this to: earning passive XP every time someone visits or photos a place you created, defending your place's rating against competitors, a "curator rank" tied to the quality of your contributions. These create long-term skin in the game.

### Problem 5 — No session-to-session continuity

There is nothing that connects today's session to yesterday's or tomorrow's. A user who was active for 5 consecutive days has no visible evidence of that streak — no badge, no multiplier, no risk of losing something. Each session is isolated. **Habit formation requires a thread that connects sessions. Right now, each session is a fresh start.**

### Problem 6 — The first-session cliff

The first session has a clear path: explore → create → earn XP → feel good. The second session has none. There is no onboarding that says "here's what to do next time you open this app." The user is dropped at the home feed with no prompt. **The second session is where nearly all users are lost, and the product currently has no answer for it.**

### Problem 7 — No social gravity

There is no follow system, no way to subscribe to a friend's activity, no concept of "people near you are doing this." The activity feed is a firehose of everyone, which makes it feel impersonal. Social retention requires *specific people whose actions you care about*. Without a social graph, the community remains abstract. **Faceless communities don't pull users back. Named, followed people do.**

---

## 3. Missing Retention Loops

A retention loop has four components: **Goal → Action → Reward → Trigger to repeat.** The following are the specific loops Geometki is missing.

---

### Loop 1 — The Streak Loop (most important short-term loop)

**What it is:** Every calendar day you perform any action on Geometki, your streak counter increments. Your streak multiplies your XP earnings. If you miss a day, the streak resets to zero.

**Why it works:** Loss aversion is stronger than reward anticipation. A user with a 12-day streak will return tomorrow *to avoid losing 12 days of progress*, even if they wouldn't have returned for a positive reward. This is the engine behind Duolingo's dominance.

**What's missing:** The streak counter and XP multiplier are spec'd in Feature 03 but not built. There is no streak UI, no "your streak expires in 4 hours" push notification, and no streak milestone badges.

**The trigger:** A push notification at 8 PM local time if the user hasn't been active that day: *"Your 7-day streak ends tonight. 5 minutes is enough."*

---

### Loop 2 — The Territorial Capture Loop (most important long-term loop)

**What it is:** Every place in the world that exists in OpenStreetMap data but has not been claimed on Geometki is a "ghost place" — visible on the map as a semi-transparent marker. Users claim ghost places by visiting them physically (GPS verification) or contributing their first photo or description. Claiming earns 2–3× bonus XP. Unclaimed places accumulate and create a visible "incompleteness" in the map.

**Why it works:** The map goes from a static atlas to a living territory with gaps. The user sees 47 uncaptured places within 5 km and feels the urge to close them. This is the core loop of Geocaching — there's always another cache to find. The pull is geographic and personal: these places are *near you*, and no one has claimed them yet.

**What's missing:** Feature 11 (Overpass integration) is spec'd but not built. This is likely the single highest-leverage feature for driving active outdoor engagement and return sessions.

**The trigger:** "3 new ghost places appeared in [your district] this week. You're the closest active user."

---

### Loop 3 — The Daily Challenge Loop

**What it is:** Every day at midnight, 3 short challenges refresh: "Rate 3 places near you (+30 XP)", "Upload a photo today (+20 XP)", "Visit a category you haven't contributed to (+40 XP)". Weekly challenges are larger: "Create 5 new places this week (+150 XP)".

**Why it works:** It answers the "what should I do today?" question that the current product never answers. It creates a time-bounded reason to open the app and gives new and experienced users alike a concrete action to take.

**What's missing:** Feature 02 is spec'd. The challenges system is not built. No challenge widget exists on the homepage.

**The trigger:** Morning push notification: *"Your daily challenges are ready. You're on a 4-day streak."* These two triggers reinforce each other.

---

### Loop 4 — The Progression and Rank Loop

**What it is:** Beyond raw XP, users have: (a) a Curator Rank tied to the quality of the places they create, (b) a regional Territory rank showing their contribution score vs. other users in a given city or district, (c) Achievement badges at milestone thresholds. Each of these is a separate dimension of progress that doesn't cap out when the XP level does.

**Why it works:** Multiple simultaneous progress bars prevent the "I hit the ceiling" problem. A level-30 user has no more XP progress, but can still climb Curator rank, capture ghost territories, and earn seasonal badges. Endless ladders sustain long-term users.

**What's missing:** Feature 01 (achievements), Feature 04 (territory), Feature 05 (curator rank) are spec'd but not implemented. The single XP/level track is currently the only progression dimension.

---

### Loop 5 — The "Your World Changed" Loop

**What it is:** When a user returns after absence, the app communicates what happened in their world: "Your place [name] was viewed 23 times this week", "Someone bookmarked your photo in [city]", "You were overtaken in [district] by another explorer", "A new ghost place appeared 400m from your home pin."

**Why it works:** It creates the sensation that the app is alive and that *the user's past actions have ongoing consequences*. This is the "missed state" hook — the feeling that something is happening without you and you should check in.

**What's missing:** The notification system today only covers real-time events on your places (someone rated it, commented, etc.). There is no weekly digest, no territory change alert, no "world summary" for returning users.

**The trigger:** A weekly email digest with a personal "what happened in your world this week" summary.

---

### Loop 6 — The Social Witness Loop

**What it is:** Users can follow other explorers. Your home feed shifts from "all community activity" to "activity from people you follow + nearby activity." When someone follows you, you get a notification. Leaderboards for your region show where you rank among active local users.

**Why it works:** Abstract community engagement ("someone somewhere rated a place") is weak. Specific social gravity ("Alex, who you follow, just created a place 2 km from you") is strong. Named people create accountability and curiosity.

**What's missing:** There is no follow system. The activity feed is a global firehose, not a personalized social graph. This is a significant architectural gap that will require backend and frontend work.

---

## 4. Proposed Product Direction

**Current definition (implicit):** Geometki is a map where people add places they know about.

**Proposed definition:**

> Geometki is a field game for curious people — an ever-incomplete map of the real world that you explore, claim, and defend, one physical visit at a time.

The word *game* is intentional. Not in a trivial sense, but in the sense that the world has rules, scores, progress, and consequences. You can win territory and lose it. You can build a streak and break it. There are things near you waiting to be discovered. The map is never finished. Every time you step outside, there is a reason to open Geometki.

---

## 5. Feature Roadmap (Retention-Focused)

### Phase 1 — Core Retention (Build the Thread Between Sessions)

**These features have the highest ratio of retention impact to implementation effort. None require major architectural changes.**

---

#### 1.1 — Activity Streaks + XP Multiplier

**What:** Track consecutive days of any activity. Show current streak (flame icon + count) in the header on every page. Apply XP multiplier tiers (×1.0 / ×1.1 / ×1.25 / ×1.5 / ×2.0) based on streak length.

**Why it improves retention:** Loss aversion triggers daily return. The multiplier makes each subsequent day more valuable than the last, creating compounding motivation. A 14-day streak user earns 25% more XP from every action — they will not break that streak for a mild inconvenience.

**How to implement:** Two new columns on the `users` table (`current_streak`, `longest_streak`). Logic in `ActivityLibrary::push()` — compare today's date to `last_active_date`, increment or reset. A `streak` command in settings for "streak freeze" (optional, can come in Phase 2). Frontend: flame icon in the site header, streak count tooltip, streak stats on profile. **Estimated effort: 3–5 days backend + 2 days frontend.**

---

#### 1.2 — "Your World at a Glance" Dashboard Widget

**What:** Replace the anonymous home page carousel with a personalized dashboard for logged-in users. The dashboard shows: current streak + days until next multiplier tier, active daily challenges (if built, or a placeholder), XP progress to next level, and "Places near you" (places within a radius that the user hasn't visited or rated yet).

**Why it improves retention:** The current home page gives a logged-in user nothing personal to act on. This widget answers the question *"What should I do right now?"* in 3 seconds. Every time the user opens the app, there is a specific, personalized action waiting.

**How to implement:** New API endpoint `GET /users/me/dashboard` returning: streak data, XP progress, nearest unrated places (spatial query using existing `lat/lon` fields and `users_visited_places`). New `DashboardWidget` component on the home page, rendered only when authenticated. **Estimated effort: 3 days backend + 3 days frontend.**

---

#### 1.3 — Daily Challenges

**What:** Three rotating daily tasks reset at midnight (UTC+user timezone). Examples: "Rate 3 places", "Upload a photo to any place", "Add a place in a category you haven't tried". One weekly challenge: "Create 5 places this week". Each shows a progress bar and XP reward. Completion triggers a toast notification and XP award.

**Why it improves retention:** Structured tasks eliminate the "I don't know what to do" problem that causes users to close the app. The daily reset creates a time-anchored reason to return every morning. The weekly challenge creates mid-week check-in behavior.

**How to implement:** New `challenges` and `users_challenges` tables. Cron job rotates active challenges daily/weekly. `GET /challenges` returns active challenges + user progress. Frontend: challenge widget in the dashboard (above the fold on home page for logged-in users). Progress tracked via the existing `ActivityLibrary::push()` — challenges subscribe to activity events. **Estimated effort: 5–7 days backend + 3 days frontend.**

---

#### 1.4 — Level-Up Ceremony and Next-Level Preview

**What:** When a user earns enough XP to level up, show a full-screen celebration modal: confetti, the new level badge, the level title, and a preview of what reward or privilege unlocks at the next level. If the next level unlocks a special ability (e.g., "At Level 10 you unlock Streak Freeze"), show it.

**Why it improves retention:** The level system exists but leveling up currently has no moment of ceremony. The user may not even notice they leveled up. A celebration creates a dopamine moment and the next-level preview creates forward pull — "I'm only 500 XP away from unlocking X."

**How to implement:** The `notifications` system already delivers level-up events with `meta.level` and `meta.experience`. Add a client-side check after any RTK Query mutation that returns updated XP: if new level > current level, trigger the modal. The modal content is driven by the existing `GET /levels` endpoint. **Estimated effort: 1–2 days frontend only.**

---

#### 1.5 — Achievement Badges (Core Set Only)

**What:** Launch 15 base achievements covering the most common actions: first place created, 10 places, 50 places, first photo, 100 photos, first rating, 7-day streak, 30-day streak, first edit, 5 categories explored, first ghost capture (Phase 2). Show earned badges on the user profile as a badge shelf. Show a modal on first unlock.

**Why it improves retention:** Achievements create named milestones on top of the anonymous XP counter. "I'm 3 places away from the Explorer Silver badge" is a more concrete and motivating goal than "I need 340 more XP for level 12." Named goals have stronger pull than undifferentiated numbers.

**How to implement:** The DB schema for achievements exists. A fast pre-filter check is already planned in `AchievementsLibrary::check()`. Launch the nightly evaluation cron for the base 15 achievements. Frontend: badge shelf on profile (top 6 badges), badge catalogue page, unlock modal (reuse level-up modal pattern). **Estimated effort: 4–6 days backend + 2–3 days frontend.**

---

#### 1.6 — Verified Visit Mechanic ("Я здесь был")

**What:** Extend the existing visited toggle with: (a) a `visited_at` timestamp, (b) optional GPS-based verification — if the user shares their location and is within the place's configurable radius, the visit is marked "verified" with a ✓ badge. Unverified visits count identically toward all stats and achievements; verification is an opt-in signal, never a gate. A soft UX prompt asks for location permission on click. An offline queue in `localStorage` handles connectivity gaps (e.g., remote areas) — visits recorded offline are submitted on reconnect, with coordinates up to 24 hours old accepted. Places that are physically unreachable (island, reservoir center) get a `verification_exempt` flag; for them, the prompt is suppressed entirely.

**Why it improves retention:** The `visited_at` timestamp unblocks seasonal achievement windows (count only visits during an event period), Fog of War integration (Feature 17), and the "First Explorer" mechanic (Feature 11). The verification badge adds a lightweight trust layer to the map — a place with 40 verified visits signals real-world relevance in a way 40 anonymous clicks cannot. It also creates a small moment of ceremony around physical exploration: the app acknowledges you were actually there.

**How to implement:** Two non-breaking migrations: add `visited_at`, `verified`, `lat`, `lon` to `users_visited_places`; add `visit_radius_m` (default 200) and `verification_exempt` to `places`. Update `Visited.php::set()` to accept optional `lat/lon` and run a Haversine distance check. Frontend: geolocation prompt modal on button click, `localStorage` offline queue, updated visit counter showing `34 visits · 12 verified ✓`. See `features/18-visited-places-checkin.md` for full spec. **Estimated effort: 2–3 days backend + 2 days frontend.**

---

#### 1.7 — "Streak Expires Tonight" Push / Email Notification

**What:** A proactive notification (push on mobile, email on web) sent at 8 PM local time if the user has an active streak of 3+ days but has not been active today. Message: *"Your 8-day streak ends in 4 hours. One action is enough to keep it."*

**Why it improves retention:** This is the single highest-converting notification type for habit-forming apps. It is a direct re-engagement trigger targeted at high-intent users (those who already have a streak). It also contextualizes the stakes clearly: time pressure + loss frame.

**How to implement:** A scheduled cron job runs at 19:00 UTC daily, queries users with `current_streak >= 3` AND no activity today, sends push notification (via `expo-notifications` token on mobile) or email. Short-circuit for users who have already been active that day. Email uses the existing notification email infrastructure. **Estimated effort: 2–3 days backend + notification template.**

---

### Phase 2 — Engagement Layer (Build the Ongoing Game)

**These features create the ongoing game loop — reasons to keep playing after the initial novelty wears off.**

---

#### 2.1 — Ghost Places (Overpass Integration)

**What:** Pre-populate the map with "ghost places" sourced from OpenStreetMap via the Overpass API. Ghosts appear as semi-transparent gray markers with a lock icon. A counter on the map shows "X uncaptured places in this area." Users claim a ghost by: (a) physically visiting it within 200 meters for 3× XP, or (b) adding a description or photo for 2× XP. After capture, the ghost becomes a full colored place with the OSM data (opening hours, website, Wikipedia link) merged in.

**Why it improves retention:** This is the most important feature in the entire roadmap. It transforms the map from a static repository into a living game board with gaps that need filling. "47 uncaptured places within 5 km of you" is a concrete, geographically personal reason to go outside and open the app. It answers the fundamental question that drives all exploration games: *What's still out there?*

**How to implement:** Feature 11 spec covers this in detail. New `places_overpass` table, Overpass API fetch cron (6h interval), deduplication algorithm, ghost map layer toggle, capture API endpoints (`POST /places/ghost/{id}/capture`), GPS verification logic. **Estimated effort: 10–14 days backend + 5–7 days frontend.**

---

#### 2.2 — Regional Territory (City/District Champions)

**What:** Each geographic district (derived from existing place coordinates via reverse geocoding) has a current champion — the user with the highest weighted contribution score (places × 3 + photos × 1 + edits × 2) in that area. The champion badge appears on the map, on the district's place list header, and on the champion's profile. When you overtake someone, both users get notified. Champion status earns +5 XP passively each day.

**Why it improves retention:** Territory creates a competitive stake that persists between sessions. The user doesn't just contribute to an abstract global map — they *own a piece of it* and can lose that ownership. Losing territory is a strong re-engagement trigger, stronger than any reward. "You've been overtaken in Arbat District" will bring a user back when nothing else would.

**How to implement:** Feature 04 spec. Daily cron calculates scores per district, updates `region_champions` table. Push/email notification on rank change. Map overlay showing district boundaries (can use existing Nominatim geocoder). **Estimated effort: 8–12 days backend + 4–6 days frontend.**

---

#### 2.3 — Place Quality Score and Curator Rank

**What:** Each place has a quality score (0–100) based on: description length, number of photos, rating count and average, confirmed coordinates, post-creation edits. A place's quality tier (Stub / Basic / Good / Featured) is shown on its card. The place's creator earns ongoing +1 XP each time someone rates or photos a Featured place they created. Users earn a Curator Rank (Bronze/Silver/Gold/Master) based on the average quality of their places.

**Why it improves retention:** This converts place creation from a one-time event into a long-term investment. A user with 12 Featured places earns passive XP daily. Improving an existing place (adding photos, fixing the description) now has a clear payoff path. The Curator Rank gives experienced users a new dimension of progression even after reaching level 30.

**How to implement:** Feature 05 spec. New `quality_score` column on `places`. Calculation function triggered on edits + nightly recalculation job. Tier badge component on place cards. Ongoing XP passive awards via scheduled job querying Featured places with recent activity. **Estimated effort: 5–7 days backend + 3 days frontend.**

---

#### 2.4 — Seasonal Events and Community Goals

**What:** Time-limited (1–4 week) themed events: "Spring Urban Discovery", "Heritage Hunt", "Winter Indoors". Each event targets specific place categories. All users participate by contributing places in the targeted categories during the event window. Individual rewards scale with contribution count (1 place = Bronze badge, 5 = Silver, 15 = Gold). A global community progress bar counts toward a collective goal; if the community reaches it, everyone gets a bonus.

**Why it improves retention:** Seasonal events create urgency (they end) and novelty (each event is different). The community goal adds a cooperative dimension — the user feels they are contributing to something larger. Events give long-time users something new and different to do within the existing contribution mechanics.

**How to implement:** Feature 06 spec. New `events` and `users_events` tables. Event banner component on home page. Cron manages event lifecycle and progress updates. **Estimated effort: 6–8 days backend + 4 days frontend.**

---

#### 2.5 — Follow System and Personalized Activity Feed

**What:** Users can follow other explorers. The home feed shows a toggle: "Following" (activity from followed users + nearby activity) vs. "Global" (current behavior). When someone follows you, you receive a notification. Your follower/following counts are shown on your profile.

**Why it improves retention:** The most powerful social retention mechanic is caring about specific people. The global activity feed is interesting once; your friends' activity is interesting every day. This also enables social accountability: if Alex you follow is on a 14-day streak, you'll want to match it.

**How to implement:** New `users_follows` join table. New API endpoints `POST /users/{id}/follow`, `DELETE /users/{id}/follow`, `GET /users/{id}/followers`, `GET /users/{id}/following`. Modify activity feed query to filter by followed users when `filter=following`. Follow button on user profiles. Notification on new follower. **Estimated effort: 4–6 days backend + 3 days frontend.**

---

#### 2.6 — Dynamic Place Freshness Badges

**What:** Every place displays a visible freshness badge indicating its content completeness and recency. The badge tiers are:

| Tier | Badge | Visual | Criteria |
|------|-------|--------|----------|
| 1 | **Stub** | Gray, dashed outline | Title only, no description or photos |
| 2 | **Draft** | Yellow outline | Has description OR at least 1 photo, but not both |
| 3 | **Complete** | Green solid | Has description AND 2+ photos AND at least 1 tag |
| 4 | **Verified** | Blue with checkmark | Complete + has been edited/updated within last 6 months + has 3+ ratings |
| 5 | **Exemplary** | Gold with star | Verified + 5+ photos + 10+ ratings + updated within last 3 months |

**The decay mechanic:** Freshness degrades over time. A place that was "Exemplary" will drop to "Verified" after 3 months without updates. A "Verified" place drops to "Complete" after 6 months of inactivity. This creates a living map where information quality is visually apparent and where neglected places signal "this needs attention."

The decay clock resets on any meaningful update: description edit, new photo upload, new comment from the author, or a verified visit by a user who confirms "this place still exists as described."

**Why it improves retention:**

1. **For place creators:** Your high-quality contributions are visibly recognized. The badge is social proof that you did the work. But that recognition fades if you abandon the place — creating a reason to revisit and update your own places periodically.

2. **For explorers:** The badge immediately signals trust. A "Verified" or "Exemplary" place is worth visiting; a "Stub" is a gamble. This improves the overall user experience of the map.

3. **For the retention loop:** Decaying badges create a recurring maintenance task. The notification "Your place [Café Pushkin] dropped from Verified to Complete — it hasn't been updated in 7 months" triggers a return visit. The user thinks: "I should check if they changed their hours" — and goes there physically, potentially uploading a new photo.

4. **For gamification:** Daily/weekly challenges can target freshness: "Update 3 of your places that dropped a tier this month (+50 XP)", "Bring a Stub place to Complete (+30 XP)". The badges integrate naturally with the challenge system.

**Badge display locations:**
- Place card in search results and map popups (small icon next to place name)
- Place detail page header (full badge with label)
- User profile stats: "12 Exemplary places, 34 Verified, 8 need attention"
- Map filter: toggle to show only "Verified+" places, or highlight "Stubs" for contribution opportunities

**Scoring formula (draft):**

```
base_score = 
    (has_description ? 15 : 0) +
    (description_length > 200 ? 10 : 0) +
    (photos_count * 5, max 25) +
    (tags_count * 3, max 15) +
    (ratings_count * 2, max 20) +
    (avg_rating >= 4.0 ? 10 : 0) +
    (has_cover_photo ? 5 : 0)

freshness_multiplier = 
    days_since_last_update <= 90 ? 1.0 :
    days_since_last_update <= 180 ? 0.85 :
    days_since_last_update <= 365 ? 0.7 :
    0.5

final_score = base_score * freshness_multiplier

Tier thresholds:
    Exemplary: final_score >= 85 AND days_since_last_update <= 90
    Verified:  final_score >= 60 AND days_since_last_update <= 180
    Complete:  final_score >= 35
    Draft:     final_score >= 10
    Stub:      final_score < 10
```

**Notifications triggered by decay:**
- "Your place [name] dropped from Verified to Complete. It hasn't been updated in 7 months. Is the information still accurate?" (links to edit page)
- Weekly digest for prolific creators: "3 of your places need attention this month" with a list
- For Exemplary places specifically: "Your Exemplary place [name] will lose its gold badge in 2 weeks unless updated" — creates urgency before the drop happens

**How to implement:** 

Backend:
- Add `freshness_score` (int), `freshness_tier` (enum), `last_meaningful_update` (datetime) columns to `places` table
- Nightly cron job recalculates scores for all places using the formula above
- Trigger immediate recalculation on place edit, photo upload, or author comment
- New notification type `place_freshness_dropped` with weekly batching to avoid spam

Frontend:
- `FreshnessBadge` component with 5 visual states (icon + optional label)
- Badge displayed on `PlaceCard`, `PlaceHeader`, map popup
- Profile section showing freshness distribution of user's places
- Map layer filter for freshness tiers
- "Needs attention" tab on user's places list

**Estimated effort: 4–5 days backend + 3–4 days frontend.**

---

### Phase 3 — Expansion (Deepen the Platform)

**These features are for a mature platform with an established active user base. Do not build these before Phase 1 and Phase 2 are live and validated.**

---

#### 3.1 — Social Kudos and Endorsements

What: Peer-to-peer endorsements for specific skills ("Accurate Mapper", "Great Photographer", "Local Expert"). Each kudos gives the receiver +5 reputation + 10 XP. Limited to one kudos per type per recipient per month to prevent gaming.

Why it improves retention: Social validation from named peers is more emotionally meaningful than system-generated XP. Receiving a "Local Expert" kudos from someone whose places you admire creates social reciprocity that pulls both users back.

How to implement: Feature 07 spec. Single `kudos` table with UNIQUE constraint. Kudos count display on profiles. "Give kudos" dropdown on user profiles. **Estimated effort: 3–4 days backend + 2 days frontend.**

---

#### 3.2 — Photo Challenges and Community Albums

**What:** Regular themed photo missions: "Best abandoned building this month", "Most atmospheric night shot", "Unusual door in any city". Users submit photos tagged to the challenge. Community votes on submissions. Winners earn exclusive badges and featured placement on the home page.

**Why it improves retention:** Photography-focused challenges add a creative dimension that attracts a different engagement type than exploration. Voting creates a reason to come back to see results. Featured placement is a social reward that motivates effort.

---

#### 3.3 — Streak Freeze and Consumable Items

**What:** At Level 10, users unlock "Streak Freeze" — a consumable item that protects a streak for one missed day. Users earn additional freezes at milestone achievements and streak milestones. A small inventory system tracks available freezes.

**Why it improves retention:** Streak freezes make the streak system fair for occasional real-world disruptions, reducing churn from users who break a long streak through circumstances and feel it's not worth starting over. They also function as an engagement reward — earning freezes becomes a goal in itself.

---

#### 3.4 — Import from Trails / Route Recording

**What:** Full integration of the mobile app's route recording with the web client. Completed routes are importable as place waypoints. A "Routes" section shows your recorded trips on the map with distance, duration, steps, photos taken along the way.

**Why it improves retention:** Routes transform Geometki from a destination discovery tool into a movement tracking tool. Active users (hikers, cyclists, urban walkers) have a reason to open the app on every trip and to return to log and review past trips.

---

## 6. The "Second Visit" Scenario

This is the most important section of this document. The second visit is where the product currently fails. Here is what it should look like after Phase 1 is built.

---

**User profile:** Masha. She created an account 4 days ago. She created 2 places in her neighborhood, uploaded 3 photos, and rated a cafe. She hasn't opened the app since.

**Today she receives a push notification at 8:12 PM:**

> *"Your 3-day streak ends tonight 🔥 — open Geometki to keep it."*

She opens the app. The home screen now shows her personal dashboard:

```
🔥 3-day streak  |  Keep it going today
────────────────────────────────────────
Level 4 ━━━━━━━━░░  1,240 / 1,800 XP

📋 Daily Challenges (reset in 6h)
  ✓ Upload a photo           +20 XP  [DONE]
  ○ Rate 3 places near you   +30 XP  ●●○○○
  ○ Try a new category       +40 XP

📍 Near you — not yet rated
  → Паркинг на Садовой       0.3 km
  → Библиотека Некрасова      0.7 km
  → Арт-пространство RAMP     1.1 km
```

She sees she already completed one challenge. She needs to rate 2 more places. She taps "Паркинг на Садовой" — she actually knows this parking lot, it's unremarkable, she rates it 2 stars and moves on. One place down, one to go. She taps "Арт-пространство RAMP" — she visited this space last month, she likes it, she rates it 5 stars and leaves a comment about the exhibition. Challenge completed.

A toast appears: *"Daily challenge complete! +30 XP. Streak continues: 4 days 🔥"*

She glances at the XP bar: 1,480 / 1,800. Only 320 XP to level 5. She notices a banner: *"4 ghost places near you. Be the first to capture them."* She taps it and sees the map — there are 4 semi-transparent markers within a kilometer. One of them is a bookshop she passes every day. She taps it, sees the OSM data, confirms it with a photo. Ghost captured. +2× XP. She's now at 1,580 / 1,800.

She closes the app. She didn't plan to use it for 20 minutes, but she did. Tomorrow, the notification will remind her again.

**That is the second visit.** The app gave her a defined goal, a reason to go through the neighborhood, a social reward (capturing a ghost place no one else had), and a moment of closure (challenge completed). She will come back tomorrow.

---

## 7. Quick Wins

The following improvements require minimal engineering effort but produce measurable retention impact. All are achievable within the existing stack without architectural changes.

---

### QW1 — Level-up celebration modal (1–2 days frontend)

The level system works. Leveling up does nothing visible. Add a full-screen modal with the new level badge, the level title, and a one-line description of what unlocks next (even if that's just "you're getting closer to Level X"). This creates the dopamine moment the progression system is supposed to deliver but currently withholds.

---

### QW2 — "Places near you that you haven't rated" widget (2–3 days)

On the home page for logged-in users, show 3–5 nearby places the user has never rated (query uses `users_visited_places` and `ratings` tables to exclude already-rated places, plus a spatial radius query from the user's last known location). This is a concrete, personalized, immediately actionable prompt. It answers "what should I do?" without building the full challenges system.

---

### QW3 — Weekly email digest (2–3 days backend) `[🚧 IN PROGRESS]`

Every Monday morning, send a personalized email: "Your week on Geometki" — how many XP you earned, how many places you visited, how your places performed (views, bookmarks, ratings received), and a tease about what happened in your city. The email requires no new features, only a query against existing data and a scheduled email job. This re-engages users who have gone cold and who would otherwise never think to re-open the app.

**Implementation scope (current sprint):**
- `[✅ IMPLEMENT NOW]` Migration: `users.email_digest_enabled` (default 1) + `users.digest_sent_at`
- `[✅ IMPLEMENT NOW]` `DigestService.php` — collects week summary, place activity, community highlights
- `[✅ IMPLEMENT NOW]` `WeeklyDigestCommand.php` (`php spark digest:weekly [--user <id>]`) — cron entry point
- `[✅ IMPLEMENT NOW]` Digest email template (view)
- `[⏳ PENDING]` Streak section — blocked on Feature 1.1 (activity streaks)
- `[⏳ PENDING]` Freshness alerts section — blocked on Feature 15
- `[⏳ PENDING]` Rank changes section — blocked on Feature 13
- `[⏳ PENDING]` New followers section — blocked on follow system
- `[⏳ PENDING]` Ghost places action prompt — blocked on Feature 11

---

### QW4 — "Your place was viewed X times this week" notification (1–2 days)

If a user's place accumulates 20+ views in a week, send a notification: *"Your place [Name] was viewed 34 times this week."* This costs nothing to implement (views are already tracked) and creates a sense that the user's contribution is alive and being appreciated. It also pulls them back to check their place and possibly improve it.

---

### QW5 — Streak indicator in the site header (1 day frontend)

Even before the full streak logic is built on the backend, display the streak count in the header (once the backend is done). The visibility of the streak counter is itself a retention mechanic — users who can *see* their streak think about preserving it. Hiding a streak in the profile settings defeats the purpose. It needs to be in the persistent header, next to the XP bar, always visible.

---

### QW6 — First-session onboarding (2–3 days frontend)

After a user's first login, show a 3-step modal: **(1)** "Pin your home area" (let them drop a pin on the map — this enables "near you" features and personalizes the feed), **(2)** "Create your first place" (a simplified 3-field version of the create form), **(3)** "Come back tomorrow to keep your streak" (plant the streak concept before they even have one). This alone addresses the "second visit cliff" by explicitly telling the user what to do next time.

---

### QW7 — "X places uncaptured near you" counter on the map (1 day, after ghost places launch)

Once the Overpass ghost places feature is live, add a sticky counter at the top of the map screen: *"14 uncaptured places in this area."* Clicking it toggles the ghost layer on. This single UI element makes the incompleteness of the map legible at a glance and activates the explorer mindset on every map visit.

---

### QW8 — Category completion progress (2 days frontend)

On the categories page, for logged-in users, show how many places in each category *they* have contributed to vs. the total. A small progress bar under each category card: "You've added 3 of 47 Cafes." This creates a collectionist goal — completing a category — that emerges naturally from existing data with no new backend work.

---

### QW9 — "Someone bookmarked your place" notification (already exists, just underutilized)

The notification system is built but email notifications are opt-in and the types are limited (rate, comment, edit, photo). Add "bookmark" as a notification trigger. When someone bookmarks your place, notify the author. This is a soft social signal — it says "your work matters" — and it costs a single line of server code to add.

---

### QW10 — Leaderboard for your region on the home page (2–3 days)

Show a small "Top explorers in [user's city] this week" panel on the home page, ranked by XP earned that week. No territory system needed — just a simple aggregate query grouped by the `address.locality` field on places. This introduces competitive social pressure with minimal engineering: who are the most active people in my city right now?

---

## Summary: Why Would a User Come Back?

After Phase 1 is complete, the answer is:

> Because their streak expires tonight, and they lose the ×1.5 XP multiplier they've been building for two weeks. Because there are daily challenges that reset tomorrow. Because there's a ghost place 400 meters from their apartment that nobody has captured yet. Because someone bookmarked their photo. Because they're 280 XP away from Level 8, and that's achievable in a single session.

After Phase 2:

> Because they're defending first place in their district and someone is catching up. Because a seasonal event ends in 6 days and they're 2 places away from the Gold tier badge. Because their friend Alex just created 3 places and moved ahead of them on the local leaderboard.

After Phase 3:

> Because Geometki is the app they open every time they leave the house. It turns any walk into a mission.

The transformation from *static atlas* to *living territory* is not a feature. It is a series of deliberate design choices, each one creating a thread from today's session to tomorrow's. This roadmap is that series of choices, ordered by impact and effort.

---

*This document should be reviewed and updated quarterly. Retention metrics to track: D1 retention (first return), D7 retention (habit forming threshold), 30-day active rate, average sessions per active user per week, and streak distribution across the user base.*