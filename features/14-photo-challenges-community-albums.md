# Feature: Photo Challenges & Community Albums

> Status: not implemented.

Monthly themed photo challenges ("Best abandoned building", "Most atmospheric night shot"). Users
submit a photo, the community votes, winners get unique badges and home page placement. Each closed
challenge becomes a permanent public **community album**. Gives non-mappers a creative reason to
take part, a second reason to come back (voting), and evergreen SEO galleries.

## Lifecycle

One challenge per month: theme on the 1st, submissions until the 22nd, voting 22nd–29th,
results on the 30th. Challenges are created by an admin (`/admin`).

## Rules

- Submissions:
  - The photo must be attached to a place on Geometki (new upload or an existing photo of the
    user's places); this anchors it on the map and proves authorship.
  - One submission per user per challenge; can be replaced until the window closes.
  - Minimum 800×600.
  - During the submission window only the count is public; all photos reveal when voting opens.
  - Accounts younger than 7 days or with fewer than 2 places can't submit.
- Voting:
  - Any authenticated user votes for 3 different submissions.
  - No self-votes; votes are anonymous and final.
  - Log a review flag if one submission gets more than 30% of all votes.
- Rewards:

  | Place | Reward |
  |---|---|
  | 1st | unique badge for that month's theme, +500 XP, "Challenge winner" label on the photo |
  | 2nd / 3rd | badge, +300 / +150 XP, label on the photo |
  | Submitted | participant badge, +50 XP |
  | Voted | +10 XP |

## Server

- Tables:
  - `challenges`: title, description, cover photo, four window datetimes, status
    `upcoming|submission|voting|closed`, winner.
  - `challenge_submissions`: challenge, user, photo, place, note, `votes_count`, `placement`;
    unique `(user_id, challenge_id)`.
  - `challenge_votes`: unique `(voter_id, submission_id)`.
  - `community_albums`: challenge, slug, title, cover photo, submissions count.
- Endpoints:
  - `GET /challenges`, `GET /challenges/{id}`
  - `GET /challenges/{id}/submissions`: count only while submissions are open;
    `?mine=1` always returns the user's own submission.
  - `POST /challenges/{id}/submissions`: `{ photo, description }`
  - `POST /challenges/{id}/votes`: `{ submissions: [...] }`
  - `GET /albums`, `GET /albums/{slug}`
- Hourly command: advance statuses; when voting ends, set placements (votes desc, then earliest),
  award XP and badges, create the album, notify the top 3, add an activity entry.

## Client

- `/challenges`: active challenge card (cover, countdown, submit / browse) and past challenges.
- `/challenges/{id}`:
  - Submission phase: theme, submit modal (pick one of my photos or upload to a place, optional
    note), my submission preview, submissions counter.
  - Voting phase: gallery with vote buttons, "2 of 3 votes used".
  - Closed: podium and full gallery, link to the album.
- `/albums` and `/albums/{slug}`: public masonry galleries; each photo links to its place.
  Need OG tags, `ImageGallery` structured data and sitemap entries.
- Profile: challenges entered and placements.
- Home page banner while a challenge is active.
