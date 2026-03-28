# Feature: Photo Challenges & Community Albums

## Overview

Regular themed photo missions run on a monthly cycle: "Best abandoned building", "Most atmospheric night shot", "Unusual door in any city". Users submit photos tagged to the active challenge. Community members vote on submissions during a voting window. Winners earn exclusive badges and featured placement on the home page. Community albums collect the best submissions permanently as a browsable gallery.

**Effort:** High (7–9 days backend + 5–6 days frontend)
**Impact:** High — adds a creative social dimension that attracts photographers, drives recurring monthly engagement, and generates high-quality visual content for the platform
**Phase:** 3 (but the album infrastructure can ship independently in Phase 2)

---

## Core Problem It Solves

All current engagement on Geometki requires you to go somewhere physically or know about a specific place. Photo challenges give users a **creative mission** they can pursue anywhere. A user who isn't a mapper or explorer can still participate as a photographer. Voting creates a second, separate reason to return (you don't just submit — you come back to vote and see results). Community albums give past contributions an ongoing home, increasing the long-term value of every submission.

---

## How It Works

### Challenge Lifecycle

```
[Submission Window: 3 weeks]    [Voting Window: 1 week]    [Results]
────────────────────────────────────────────────────────────────────►
Day 1                           Day 22                     Day 29/30
Challenge opens                 Submissions close,         Winner announced,
Theme announced                 voting opens               badges awarded,
Users submit photos             Community votes            album created
```

One challenge runs per month. The theme is announced on the 1st of each month. Submission closes on the 22nd. Voting runs days 22–29. Results are announced on the 30th.

### Submission Rules

- Photo must be uploaded to a place on Geometki (not a standalone upload). This ensures every submission is geographically anchored and adds value to the map.
- One submission per user per challenge.
- The submitted photo can be a new upload or an existing photo from any of the user's places, as long as it fits the theme.
- Minimum photo quality: must pass the existing image validation (not blurry check if feasible, otherwise at minimum 800×600px).
- Submissions are visible to all during the submission window with a count but not individual photos (prevents voting bias). All submissions reveal at once when the voting window opens.

### Voting Rules

- Any authenticated user (including those who didn't submit) can vote.
- Each user gets **3 votes** to distribute across any 3 different submissions.
- Cannot vote for your own submission.
- Votes are anonymous (you see total count, not who voted for whom).
- Voting is final — no changing votes after submission.

### Winners and Rewards

| Placement | Badge | XP Reward | Profile Reward |
|-----------|-------|-----------|----------------|
| 🥇 1st place | Exclusive monthly gold badge | +500 XP | Permanent "Challenge Winner" label on that photo |
| 🥈 2nd place | Silver participation badge | +300 XP | "Runner-up" label on photo |
| 🥉 3rd place | Bronze participation badge | +150 XP | "Top 3" label on photo |
| Submitted | Participant badge | +50 XP | "Participant" label |
| Voted | — | +10 XP | — |

The gold badge for 1st place is unique to that month's theme. "Best Abandoned Place — March 2026" is a collector's item that can never be earned again after that month. Scarcity makes it meaningful.

### Community Albums

After each challenge closes, all submissions are collected into a permanent **Community Album** — a browsable gallery accessible at `/albums/{year}/{month-slug}`. Albums are publicly accessible without login. They serve as a showcase of the community's best photography work and as evergreen SEO content.

---

## Server Design

### New Tables

**`challenges`**
```sql
CREATE TABLE challenges (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,            -- "Best abandoned building"
    description     TEXT NOT NULL,                    -- theme brief + inspiration
    cover_photo_id  INT UNSIGNED NULL,                -- admin-set cover for the challenge page
    submission_starts_at  DATETIME NOT NULL,
    submission_ends_at    DATETIME NOT NULL,
    voting_starts_at      DATETIME NOT NULL,
    voting_ends_at        DATETIME NOT NULL,
    status          ENUM('upcoming', 'submission', 'voting', 'closed') NOT NULL DEFAULT 'upcoming',
    winner_user_id  INT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**`challenge_submissions`**
```sql
CREATE TABLE challenge_submissions (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    challenge_id  INT UNSIGNED NOT NULL,
    user_id       INT UNSIGNED NOT NULL,
    photo_id      INT UNSIGNED NOT NULL,   -- FK to existing photos table
    place_id      INT UNSIGNED NOT NULL,   -- FK to places, derived from photo
    description   VARCHAR(500) NULL,       -- optional submission note from user
    votes_count   INT UNSIGNED NOT NULL DEFAULT 0,
    placement     TINYINT UNSIGNED NULL,   -- 1, 2, 3, NULL for others
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_challenge (user_id, challenge_id),
    KEY idx_challenge (challenge_id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);
```

**`challenge_votes`**
```sql
CREATE TABLE challenge_votes (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    challenge_id   INT UNSIGNED NOT NULL,
    voter_id       INT UNSIGNED NOT NULL,
    submission_id  INT UNSIGNED NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_vote (voter_id, submission_id),
    KEY idx_challenge_voter (challenge_id, voter_id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES challenge_submissions(id) ON DELETE CASCADE
);
```

**`community_albums`**
```sql
CREATE TABLE community_albums (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    challenge_id  INT UNSIGNED NOT NULL UNIQUE,
    slug          VARCHAR(100) NOT NULL UNIQUE,   -- '2026-03-abandoned-buildings'
    title         VARCHAR(200) NOT NULL,
    cover_photo_id INT UNSIGNED NULL,             -- winner's photo
    submissions_count INT UNSIGNED NOT NULL DEFAULT 0,
    views         INT UNSIGNED NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
```

### API Endpoints

**`GET /challenges`** — list of challenges (current, upcoming, past with pagination)

**`GET /challenges/{id}`** — challenge detail + submission count + current user's submission status

**`GET /challenges/{id}/submissions`**
- During submission window: returns count only (no list)
- During voting/closed: returns full list with vote counts, ordered by votes DESC
- Query param `?mine=1` returns the authenticated user's own submission at any time

**`POST /challenges/{id}/submissions`** — submit a photo; body: `{ photo_id, description }`
- Validates: submission window open, user hasn't submitted, photo belongs to user, photo attached to a place

**`POST /challenges/{id}/votes`** — cast votes; body: `{ submission_ids: [1, 2, 3] }`
- Validates: voting window open, max 3 submissions, no self-vote, user hasn't voted these before
- Awards +10 XP to voter, updates `challenge_submissions.votes_count`

**`GET /albums`** — paginated list of community albums, newest first

**`GET /albums/{slug}`** — album detail with all submissions (sorted by placement, then votes)

### Cron Job: `ChallengeStatusCommand.php`

Runs every hour:
```php
// 1. Update challenge `status` based on current datetime vs. date fields
// 2. When voting_ends_at passes and status is still 'voting':
//    a. Calculate placements (ORDER BY votes_count DESC, created_at ASC)
//    b. Set placement 1, 2, 3 on top submissions
//    c. Set challenge.winner_user_id
//    d. Award XP + badges to winner and top 3
//    e. Create community_album row
//    f. Set challenge.status = 'closed'
//    g. Send winner notification to top 3 users
//    h. Post activity feed entry: "March challenge results are in! [Winner] took first place."
```

---

## Client Design

### Challenges Page (`/challenges`)

Split into tabs:
- **Active** — current challenge with countdown timer, submission/voting CTA
- **Past** — grid of past challenges with winner's photo as thumbnail

**Active challenge card:**
```
┌────────────────────────────────────────┐
│  [COVER PHOTO]                         │
│  Best Abandoned Building               │
│  March 2026                            │
│                                        │
│  📸 47 submissions   ⏱ 8 days left    │
│                                        │
│  [Submit a photo]  [Browse submissions]│
└────────────────────────────────────────┘
```

### Challenge Detail Page (`/challenges/{id}`)

**During submission window:**
- Theme description + inspiration text
- "Submit your photo" button → opens photo picker modal (shows user's existing photos from their places + upload new option)
- User's own submission preview (if submitted): can delete and resubmit until window closes
- Counter: "47 explorers have submitted — submissions reveal when voting opens"

**During voting window:**
- Full gallery grid of all submissions (photo thumbnail, place name, user avatar)
- Clicking a submission: full-size photo, place link, submit note
- Vote button on each (inactive if already voted, replaced by vote count)
- User's own submission: shown with "your submission" label, no vote button
- Progress indicator: "You've used 2 of 3 votes"
- Countdown to results

**After close:**
- Podium display: 1st, 2nd, 3rd with large photos and vote counts
- Full gallery below, sorted by votes
- Share button (generates og:image with winner's photo + challenge title)
- "View Album →" link to permanent community album

### Submission Modal

Triggered by "Submit a photo" button:
1. Photo source selector:
   - "Choose from my places" → scrollable grid of user's existing place photos
   - "Upload new photo" → standard uploader (photo attaches to a place the user selects)
2. Place link confirmation: "This photo is from [Café Pushkin]" with a link to verify
3. Optional description field (500 chars): "What made you take this shot?"
4. Submit button → confirm modal: "Once submitted, you can change your submission until March 22nd"

### Community Albums Page (`/albums`)

Masonry grid of past albums. Each card: cover photo (winner's submission) + month + theme + submission count.

### Album Detail Page (`/albums/{slug}`)

Full-bleed masonry gallery. Top section: podium with 1st/2nd/3rd and their XP awards. Below: all submissions in vote-order. Each photo links to the original place. Ideal landing page for search engine traffic ("best abandoned buildings in Moscow").

### User Profile: Challenge History

New tab "Challenges" on user profile showing:
- All challenges entered, with placement
- "Challenge Winner" badges earned (from achievements system)

### Home Page Integration

During active challenge, a persistent banner in the home feed:
```
📸 March Photo Challenge: "Abandoned Buildings"
47 submissions · Voting opens March 22
[Enter now →]
```

---

## SEO Value

Community albums are the best SEO content generator in the entire roadmap. Each album is a unique, user-generated gallery with geographic metadata. Examples of organic search targets:
- "best abandoned places in Moscow photos"
- "night photography Russia urban"
- "unusual doors Saint Petersburg"

Albums should have proper OG meta tags, structured data (ImageGallery schema), and descriptive slugs. They generate backlinks and are shareable on social media without requiring a Geometki account to view.

---

## Anti-Abuse

- **Alt account padding:** Submissions from accounts < 7 days old or with fewer than 2 places are rejected.
- **Vote farming:** The 3-vote limit and uniqueness constraint make coordinated voting significantly less effective. If any submission receives more than 30% of total votes, a soft review flag is logged.
- **Photo theft:** The requirement that photos must be attached to a place on Geometki creates an automatic authorship chain.

---

## Metrics to Track

- **Submission rate:** % of MAU who submit to any challenge
- **Voter/submitter ratio:** should be 3:1+ (voting is easier, should have higher participation)
- **Album page views:** SEO-driven external traffic to community albums
- **Challenge-driven place creation:** places created specifically to host a challenge submission
- **Repeat participation rate:** % of challenge participants who participate in the next challenge
