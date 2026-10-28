# Feature 25: Visits and Exploration

> Status: steps 1–4 and 6 in `release/1.18.0` (2026-10-26); steps 5 and 7 planned for 1.19.0. Replaces feature 17 (Fog of War) and the visit parts of 15 and 24;
> takes the first steps of 13 (Regional Leaderboards).

Two ways to contribute, both visible:

- **Open a white spot**: add a place where the map knows something is, but Geometki has nothing.
- **Check in at a place**: say "I was here", as many times as you go, and bring something back:
  photos, a few words, answers to two or three one-tap questions. A check-in changes the place
  page at once ("How it is now", "Last visit") and is credited to you there.

The map shows how much of an area is explored: hexagons when zoomed out, points when zoomed in,
a percentage per location, the people who explore it.

No crawling: candidate tiles are still collected only where somebody looks at the map
(`OsmTilesModel::request()` → `osm:collect`), so the map grows as people explore it.

## Order of work

| Step | What | Depends on | Size |
|------|------|------------|------|
| 1 | Visits: repeatable one-tap check-ins, no GPS | — | server + client, large |
| 2 | Visit questions: "How it is now" on the place page | 1 | server + client, medium |
| 3 | Tags removed | 2 (the questions take over the "features" role) | mostly removals, medium |
| 4 | White spots on the map, duplicates stored | — | client + small server |
| 5 | Locations of candidates, exploration %, top explorers (home page, location pages) | 4 | server + client, medium |
| 6 | Hex layer, binned in the browser | 4 | mostly client, medium |
| 7 | User page: one map of their places and visits, their exploration % | 5, 6 | server + client, medium |

Proposed releases: **1.18.0** = steps 1–4 (visits, questions, no tags, white spots),
**1.19.0** = steps 5–7 (exploration). Each step is its own PR into the release branch.

---

## Step 1: Visits

### Today

`users_visited_places` (one row per user and place by convention, no unique key) and
`PUT /visited` as a toggle: a second press removes the visit. The client sends the location when
it gets one, the server compares it with `places.visit_radius_m` and stores `verified`; three
different messages (confirmed / unconfirmed / removed), `verified_count` on the place page.
A visit gives no experience (`LevelsLibrary::$types` has no `visit`).

### New behaviour (as built, simplified after the first try-out)

- **"I was here"** is one tap: the visit is made at once, for the visitor's day, without asking
  for the location, and a toast tells the result ("Visit #24 to this place", "You are the first
  here this year"). No sheet, no form: a few words about the trip go to the comments, the photos
  to the gallery as always.
- **Repeatable.** A visit is a log entry: one person can check in at a place many times. One
  visit per user, place and day: a second tap the same day says "You already checked in here
  today". After the first visit the button is green and reads "You were here · 3 times".
- **Photos of the trip.** A photo uploaded to the place within a day of the uploader's visit
  belongs to that visit (`VisitsLibrary::photoVisit()`): no field in the upload form.
- **Guests**: the button opens the sign-in dialog and checks in after sign-in. Guests keep only
  the rating.
- **Removal**: your own visit can be deleted from the profile timeline (through `ActivityRemoval`).
  There is no toggle any more.
- **Offline queue** (`pending_visits` in `WasHereButton`) stays, without coordinates; it sends
  `POST /visits`, which is idempotent per day, so a resend cannot create a duplicate.

Tried and dropped: a sheet after the tap (day picker, note, photos) and a "Visits" section on
the place page with every visit as a row. Too much for the gain: the sidebar already says who was
here, the activity log of the place already lists every visit, the comments already take the
words. Past trips cannot be logged by date any more: the API takes `visitedAt` only within a
day of today either way (the visitor's time zone), a back-dated visit would farm the experience.
The photos uploaded to the place that day before the tap become the visit's (`adoptPhotos()`).

### Data (new migration)

- `users_visited_places` becomes the visit log:
  - drop `verified`, `lat`, `lon` (the visitor's location is not kept: see "Visitor location"
    in `CLAUDE.md`);
  - `visited_at` DATETIME → stays, the day the person was there;
  - add `created_at`, `updated_at`;
  - index `(place_id, visited_at)`, index `(user_id, visited_at)`.
- `places`: drop `visit_radius_m`, `verification_exempt`.
- `photos`: add `visit_id` VARCHAR(15) NULL, FK to `users_visited_places` ON DELETE SET NULL (the
  photo's day is the visit's day, see "Then and now").
- `activity`: add `visit_id`, the `visit` event of a visit.

### API

New `Visits` controller, replacing `Visited`:

| Route | |
|-------|-|
| `POST /visits` `{ place, visitedAt? }` | Creates the visit (or returns the same day's one with `isNew: false`), with `ordinal` and `firstThisYear` |
| `DELETE /visits/:id` | Author or admin |
| `GET /visits?place=:id&limit&offset` | Visits of a place, newest first, with the author and photos; `count`, `people`, `last`, `visitors` (the latest five people) |
| `GET /visits?user=:id&limit&offset` | A user's visits with their places (the profile timeline) |
| `GET /visits/places?user=:id` | Distinct places a user visited (replaces `GET /visited/user/:id`) |
| `GET /visits/me?place=:id` | The signed-in user's visits of a place (the button state, in the browser) |

`GET /visits?...` is public and depends only on the path and query: it is in the `GuestCache`
groups instead of `visited`. `GET /visits/me` stays out of it.

### Activity, feed, notifications

- Each visit is an `activity` of type `visit` (as now), shown in the place's activity log
  (the "Change history" row of the place page is now "Activity log").
- Feed: visits keep the "visited 5 places" grouping (weight 1); the photos of a visit make the
  author's photo story of the place, so a visit with photos is a card anyway.
- The place's author gets the `visit` notification (exists). No new types.
- Place pages are revalidated: `visit` is already a place activity in `ActivityLibrary`.

### Experience and achievements

- No experience for a bare visit: without GPS it would be a free farm.
- **A visit with photos**: +10 XP (`MODIFIER_VISIT`), at most once per user, place and calendar
  month of the visit day; counted from the log on every recount (`VisitsLibrary::contributions()`),
  never pushed, so a deleted photo or visit takes it back. Photos keep their own experience.
- `places_visited` counts `DISTINCT place_id`.
- New metrics for achievements: `visits_total`, `places_revisited` (one place in 2+ calendar
  years: "Chronicler"), `winter_visits` (December–February), `first_visit_of_year` (the first
  visit of a place in a calendar year).

### Place page

- The "Где это" card: `PlaceVisitors` — up to five overlapping avatars of the latest visitors,
  "N people were here", "Last visit: 13 October 2026 · 23 visits" — above the button.
- **Then and now**: the photo gallery groups photos by year (visit date if the photo has one,
  else the upload date) once a place has photos from 2+ years.
- Nothing visitor-specific in the cached render: the button state comes from `GET /visits/me` in
  the browser.
- Profile: visits count next to places and photos; the "Visits" tab is a timeline (place, day,
  the photos of the day), with the places view as a switch.

---

## Step 2: Visit questions

A closed list of one-tap questions, the same pattern as categories: keys on the server
(`server/app/Config/VisitQuestions.php`: keys, allowed values, the categories each applies to),
the enum and texts on the client (`common.json` → `visitQuestions.<key>.title`,
`visitQuestions.<key>.values.<value>`). At most three questions for the place's category, in a
fixed order. Every one has "Don't know" by not answering.

**As built (2026-10-26):** the questions are asked right under the green button after a
check-in (`PlaceVisitQuestions` in the "Где это" card): a signed-in visitor whose latest visit
(of any day: the visits made before the questions are asked too) lacks answers sees the first unanswered question of the category as chips, one tap saves
it (`PATCH /visits/:id { answers: { road: 'dirt' } }`, null removes), the next question
follows, "Пропустить" hides the block for that visit (localStorage). On phones the button is
in the bottom bar, far from the card, so a check-in there opens the same block in a bottom
sheet (`variant="sheet"`, like "Маршрут") instead of the toast: the result of the check-in
("Визит №3 в это место", "Вы уже отмечались здесь сегодня", the first-of-the-year line) is the
sheet's title (`checkInMessage()`); the sheet closes on "Пропустить", "Готово" (the thanks go
to a toast) or at once when there is nothing to ask, and then the result is a toast after all.
On desktop nothing opens, the toast stays. `GET /visits/me?place=`
carries the `questions` of the place's category, so the client has only the texts. An answer is
a contribution (experience, see step 1).

The list (13 questions; a category has a pool of six to eight, a visit asks **three** of them:
the ones the place has no answer to yet, in the order of the pool, then the stale (older than a
year) and the contested (half or less agree) ones, the oldest first, then the rest by age;
`VisitsLibrary::questionsFor()`, no randomness, so the pool fills up visit by visit and the
list stays put while the visitor answers; the answered ones of the visit come off the share):

| Key | Values | Pools |
|-----|--------|-------|
| `road` | asphalt · dirt road, a car will pass · 4×4 only · on foot only · by water | all but museums |
| `walk` | under 1 km · 1–5 km · over 5 km | nature, archeology, mystic, disaster, camping |
| `trail` | yes, easy to follow · in places, bring a track · no trail | mountains, caves, waterfalls, landscapes, viewpoints, archeology, mystic |
| `entry` | free · paid · guarded · outside only · closed | buildings, abandoned, industrial, military, museums, caves, mountains, waterfalls, archeology, disaster |
| `state` | as in the photos · decaying · demolished | abandoned, industrial, military, buildings, memorials, artworks, archeology, disaster |
| `water` | there is water · dried up | spring, waterfall, water, camping |
| `crowd` | nobody · a few · crowded | all |
| `time` | under an hour · half a day · a day or more | all |
| `parking` | at the place · far, then on foot · nowhere | buildings, abandoned, museums, memorials, viewpoints, water, camping |
| `cell` | yes · weak · none | remote: nature, caves, abandoned, archeology, disaster, mystic, camping |
| `facilities` | nothing · toilets, shelters · a café or a shop | mountains, waterfalls, springs, water, landscapes, castles, manors, museums, camping |
| `safety` | safe · take care · dangerous | caves, abandoned, industrial, military, engineering, disaster, mystic |
| `access` | yes · partly · no (a wheelchair or a stroller) | viewpoints, castles, manors, architecture, religious, memorials, artworks, museums |

The former `swim` question is gone: the feature `can_swim` is the same fact.

The exact pools per category: `Config\VisitQuestions::$categories` (the practical one first).

**Data:** `visit_answers (visit_id, question, value)`, PK `(visit_id, question)`, index
`(question, value)`.

**Features, "what can you do here"** (the "can/cannot" of feature 24): the last step after the
questions, `{ key: 'can', features: ['swim', 'fish', …] }` in `GET /visits/me`, at most five per
category (`Config\VisitQuestions::$categoryFeatures`; the list: swim, fish, raft, beach, camp,
winter, ski, kids, dog, drink, fire). Each feature is a yes/no question of its own, stored as
`can_<feature>` → `yes` | `no` in `visit_answers`, so it follows the same "latest answer, agreement
over three years" rule. The chips are three-state: a tap is "can", a second tap "cannot", a third
clears; every tap saves, "Готово" ends the block. "Как сейчас" shows them as two rows, "Можно" and
"Нельзя", with the agreement as a tooltip. The `can_*` rows with `yes` are the place's features
for the recommendations (`UserInterestProfilesModel::collectFeatureScores()`: the places a person
bookmarks, visits, rates 4+, views; their own answers are no signal) and, later, for filters.

**`places_now`**: the summary per place and answer key (value, agree, total, visited_at,
history JSON, source), rebuilt by `VisitsLibrary::rebuildNow()` after every answer and every
deleted visit; `GET /visits?place=` reads it. `source` is `visits`; OSM or the editor can add
rows later without a visit.

**"How it is now"** in the "Где это" card (`PlaceNow`): per question the latest answer with its
date and how many of the people of the three years up to it agree, each by their latest answer ("Дорога: грунтовка · 5 из 6 ·
13 октября 2026"); the latest value of each earlier year (up to three) as history ("в 2023: только
внедорожник"). Computed in `GET /visits?place=` (`now`, `VisitsLibrary::now()`) from the
answers of the place; the page is ISR and is re-rendered after every saved batch of answers (a few taps go in one `PATCH`).

The answers are the place's features of feature 24, collected from visits instead of edited by hand.
Filters by them (`/places?road=car`) come later, once there is data.

---

## Step 3: Tags removed (as built, 2026-10-26)

Tags carried almost nothing (feature 24: 842 tags, 56% used once, half repeating the category, 16%
place names) and fed the recommendations with noise. The visit questions and features take over.

- **Server:** `Controllers/Tags.php`, `TagsModel`, `PlacesTagsModel`, `Libraries/PlaceTags.php`,
  their routes and the `tags` guest-cache group are gone; tags are out of `Places` (list filter,
  show, create, update, delete). `UserInterestProfilesModel` keeps `category` interests and
  gains `feature` ones (see step 2), `applyRecommendationSort()` weighs them in place of tags.
  Migration `DropTags`: deletes the `tag` interests, drops `places_tags` and `tags` (`down()`
  recreates them empty with the original columns).
- **Before the migration** on production: `php spark tags:export` writes
  `writable/exports/tags.csv` and `places_tags.csv`; the migration refuses to run while the tables
  hold rows and the export is missing. Keep the files next to the backup.
- **Client:** no tag field in `PlaceForm`, no tags on the place page, card and filters, no `?tag=`
  in the lists and landings, no `tags/search` endpoint; `input_tags-*` keys gone.
- **SEO:** `/places?tag=…` → 301 to the same list without the tag, for good (`proxy.ts`).
- `tools/places` publishes without tags. Feature 15 counts "answers from visits" where it counted tags.

---

## Step 4: White spots (as built, 2026-10-26)

### Map

- To the visitor the spots are "Неоткрытые места" ("white spot" stays an internal term: the
  user found it unclear). For everybody but admins, the open candidates of the tiers `known` and
  `explore` are the ghosts of place markers: the same 20px square with the candidate's category
  icon, the whole marker at 40% opacity (`CandidateMarker`, a `divIcon` per category), so they look like
  the other markers, "not here yet"; `other` is not asked for. No panel and no button for the
  visitor: the layer collects the tiles and loads the candidates quietly, there is nothing to
  switch and nothing to tell (the hexes say how much is undiscovered). Admins see the same: the
  admin mode of the layer (the legend with the coloured groups and counts, the score circles,
  the rating breakdown, link/unlink/hide in the popup) is removed from the client; the server
  keeps `PATCH /osm-candidates/:id/link|unlink|reject` for the separate admin tool (below).
- The popup: the "Не открыто" badge with the hint ("Это место ещё никто не открыл на Геометках:
  оно есть в OpenStreetMap, но без описания"), what is known (name, OSM / Wikipedia, Commons
  photos), the CTA "Откройте это место первым: +35 опыта" and the button "Добавить это место"
  (the form is prefilled from `GET /osm-candidates/:id`). After the creation: "Вы открыли новое
  место! +35 опыта" (the place and the bonus, as the CTA promised).
- The layer was already on by default on `/map` from zoom 11.

### Duplicates stored

A candidate that looks like one of our places (`OsmScoring::duplicateOf()`: a similar title
within 300 m, or the same category within 50 m) is linked to it in the database, `status =
linked`, `place_id`, `linked_by = NULL` (`OsmCandidatesModel::linkDuplicatesIn()`):

- after a tile is collected (`OsmCollector::save()`), for the tile's bounds;
- after a place is created or moved (`linkDuplicatesAround()` in `Places::create()`/`update()`);
  a moved place first lets go of its automatic links now farther than the radius
  (`reopenFarFrom()`; the pioneer's and an admin's links stay);
- a place deleted → every candidate linked to it is open again (`reopenOfPlace()`, before the
  delete: the key alone would only clear `place_id`);
- one-off `php spark osm:link-duplicates` for the stored candidates: the far automatic links
  reopened, then tile by tile (harmless to repeat). The read-time check in `OsmCandidates::list()` ("looks like", `tiers=other` and the
  duplicates) stays on the server for the admin tool.

### Closing a spot

A place created from a candidate links it with `linked_by` = the author: the **pioneer**.
`POST /places` answers `spotOpened: true`, the client says "Вы открыли новое место! +35 опыта".
The bonus `MODIFIER_SPOT` (15) is counted from the links in `LevelsLibrary::experience()`
(`OsmCandidatesModel::spotsOpened()`: the candidate's place exists and its author is
`linked_by`, so an admin linking somebody's place by hand is no pioneer), recounted on creation,
never pushed; the achievement metric `spots_opened` is checked on every `place` activity.

---

## Step 5: Exploration per location

### Locations of candidates

Candidates have only a settlement name. Add `country_id`, `region_id`, `district_id`, `locality_id`
to `osm_candidates` (indexed `(region_id, status)`, `(district_id, status)`) and fill them in the
collector, right after a tile is scored, for the open `known` / `explore` candidates:

- reverse geocoding with the existing `Geocoder` (Nominatim, 1 request/s), matching the existing
  locations by OSM id as places do;
- one request per 0.01° cell, reused by the other candidates of the cell;
- a candidate that becomes a place takes the place's location.

Still no crawling: only tiles somebody looked at are collected, so the numbers grow with the map.
A tile takes up to ~25 s longer to collect; the queue is not on a user's path.

### The numbers

For a location: **opened** = published places, **white spots** = open candidates,
**explored** = opened / (opened + white spots).

- `GET /exploration?location=<type>:<id>` → `{ places, spots, explored, contributors, leaders[] }`;
  without `location`, the whole site plus the top regions. Public, in the `GuestCache` groups with a
  `$ttls` entry, 10 min (tile collection changes it without a write, as `stats` already does with
  `unexplored`).
- The figure is "of what is known": it can go down when the map of a district is looked at for
  the first time. The block says so in its hint.

### Where it is shown

- **Home page** (ISR, 5 min): a summary block "Explored: 1 240 places opened, 3 100 white spots
  known, 29%", the 3–5 most explored regions with their bars, and the top 5 explorers (this year).
  Replaces nothing, goes after "Where to go".
- **Location pages** (`/places/{location}`, `/places/{location}/{category}` without the category
  part of the figures): "Explored 64% · 120 places · 68 white spots", "Who explores {location}" (top
  10, all time / this year) once 3+ people have a score there, the white spots of the location as a
  list "Be the first" (5 nearest to the centre, with the experience for them).
- The location pages are behind `NEXT_PUBLIC_LANDING_LOCATIONS`, off on production until about
  2026-11-15. Step 5 ships with 1.19.0, after that date; if it comes earlier, the location
  blocks wait for the flag and the home page and `/places` show the figures alone.
- **`/places`**: a "Regions" table at the bottom (explored, places, contributors), linking to the
  location pages.

### Leaders

```
score = places × 10 + spots opened × 15 + visits with a contribution × 3 + photos × 2
```

Read from `activity` joined to `places` by the location ids (all time and the current year), inside
the cached `GET /exploration` answer. At today's size this is cheap; if it grows, a table kept up to
date by `ActivityLibrary` and `ActivityRemoval` with `php spark leaders:rebuild`, like the
reputation. Champions and "you have been overtaken" notifications (feature 04) come after this.

---

## Step 6: Hex layer, binned in the browser (as built, 2026-10-26)

Like the place clusters, but counted on the client: the server sends compact points, the browser
puts them into hexagons for the current zoom. No cells table and nothing to keep up to date on writes.

- **API:** `GET /exploration/points` → `{ places: [[lat, lon, category], …], spots: [[lat, lon,
  category], …] }`: all published places and all open `known` / `explore` candidates, coordinates
  rounded to 3 decimals (~100 m), no ids, the category so the map's category filter applies to the
  cells too. 14 000 points today = 375 KB of compact JSON (the controller encodes it itself, the
  dev formatter pretty-prints), 90 KB gzipped. Public, in the `GuestCache` groups with a `$ttls`
  entry (10 min) and in `$browserTtls` (`Cache-Control: public, max-age=600`, set by the filter on
  a hit and on a miss), so a browser asks once per visit.
- **Grid:** pointy-top hexagons in Web Mercator pixels of the current zoom (they look regular on the
  map), one size on screen (circumradius 32 px, ~55 px across), so the cells get finer as the map
  zooms in, the way clusters do. `client/utils/hexGrid.ts` with tests (axial coordinates, cube
  rounding); no H3. Binning the points in view takes milliseconds, redone on `zoomend`/`moveend`.
- **Map:** below zoom 11 (`HEX_MAX_ZOOM` = `OSM_CANDIDATES_MIN_ZOOM`) the hexes instead of the
  place markers (`components/map/hex-layer`, `enableHexes` on `/map`): one fill per cell, the
  states mixed by their shares: white (not added yet: the candidates), grey (on the map), the main
  blue (the signed-in visitor's own check-ins, `GET /poi?visited=` once, binned like the points),
  so a cell turns bluer as the visitor explores; a legend in the corner; no counts inside, the
  numbers in a tooltip on hover; a click zooms two levels into the cell, like a cluster, not a
  popup. From zoom 11 the points: place markers and the undiscovered places. Cells without
  anything are not drawn: taiga and sea do not read as "unexplored".
- Only `/map` (the user page's map comes with step 7); the embedded maps keep clusters.
- Feature 17 is replaced by this and deleted.

When the points outgrow one answer (50 000+), the server sends counts per small square cell
instead of points and the browser bins those; the client does not change.

---

## Step 7: The user page

### Today

Tabs: places, visited, photos, bookmarks, collections, achievements; places and visits are separate
lists, there is no map.

### New

- **Header:** as now (level, experience, reputation), plus one exploration line: "Opened 19 white
  spots · 41 visits in 23 places · explores 3 regions".
- **One map** of the person, the first block of the overview: their places, the places they visited
  and the white spots they opened, in three tones, the chips "All / Added / Visited" above it. Below
  zoom ~11 the same browser-side hexes as `/map` (step 6): a cell is darker the more of its places the
  person has added or visited, the cells where they are the pioneer get a mark. Data from the existing
  `GET /poi?author=` and `GET /poi?visited=` plus the opened spots; the map loads when it scrolls into
  view (`next/dynamic`, `ssr: false`), the ISR render stays without API calls for it.
- **Their regions:** for each location they have contributed to: their share ("you have added or
  visited 14% of the known places of Orenburg Oblast"), their place among its explorers
  ("3rd"), and the white spots there. From `GET /users/:id/exploration` (cached, `$ttls` 10 min).
- **Visits tab** instead of "Visited": the timeline of their visits (date, place, answers,
  photos), with the "places" view as a switch.
- The "Visited" and "Places" tabs stay as lists for search engines and for people without the map.

Visits are already public (who has been at a place), so the map shows nothing new about a person.

---

## Load

What the steps add, against today's traffic (most of it guests and bots, served by the guest cache
and ISR):

| Change | Where the load goes | Estimate |
|--------|---------------------|----------|
| Visits, answers, "How it is now" | Place page is ISR: rendered once per write, the visits come in its props. Signed-in users ask `GET /visits/me` | negligible |
| Feed: visit stories | A few more rows in `feed`; `feed:rebuild` once | negligible |
| Tags removed | Fewer joins in the place list and in the recommendation sort | goes down |
| Duplicates stored | A few UPDATEs per collected tile and per new place | negligible |
| Locations of candidates | Up to ~25 Nominatim requests per collected tile, in the background job at 1/s; a tile takes ~25 s longer | background only |
| Home summary, top explorers | Inside the home page's ISR (every 5 min) | negligible |
| Location pages | They are `getServerSideProps`: one more API call per render, answered from the guest cache for guests and bots | small |
| Hex points | One cached ~50 KB answer per map visitor per 10 min; binning in the browser | small; the API does less than with server clusters |
| User page map | Two `/poi` calls when the map scrolls into view, cached for guests | small |

The real risk stays the one already in `ISSUES.md`: the Next.js process on the 1.5 GB VPS. Nothing
here adds SSR pages; moving the location pages to ISR (like the place pages) would help on its own.

---

## Planned: the admin linking tool (1.19.0 or later)

The map layer is for visitors only. The admin's work — seeing which OSM/Overpass objects look
like an existing place, confirming or breaking a link, hiding an object for good — needs its own
page under `/admin`, not the map popup: a list of candidates with a `place_id` guess
(`status = duplicate`, the similarity), the place beside the candidate, actions link / unlink /
reject (the server endpoints exist), filters by region and tier, and the stored tiles' state. Not
designed yet; the questions are the ranking of the "looks like" pairs and whether the tool also
shows the `other` tier.

## Open questions

- The visit questions (step 2): the list and the categories each applies to are a draft.
- XP numbers (+10 for a visit with a contribution, +15 for a white spot) are a starting point.

## Out of scope

GPX tracks; freshness colours of places on the map; filters by visit answers; champions (04);
streaks and challenges (02, 03).

## Docs to update along the way

Done in 1.18.0: feature 17 deleted, 13, 15 and 05 brought in line (no tags, no verified visits),
`ROADMAP.md`, `GROWTH-ANALYSIS.md`, `CLAUDE.md`. With steps 5 and 7: `ROADMAP.md` ("Exploration per
location", "Personal exploration map") and `CLAUDE.md`.
