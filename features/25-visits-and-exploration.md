# Feature 25: Visits and Exploration

> Status: open part only. Visits, visit questions, white spots and the hex layer of `/map` shipped
> in 1.18.0 (see `CLAUDE.md`, "Visits"); steps 5 and 7 are planned for 1.19.0. Takes the first steps
> of 13 (Regional Leaderboards).

The map shows how much of an area is explored: a percentage per location and the people who
explore it, and on a person's page their own map and regions.

No crawling: candidate tiles are still collected only where somebody looks at the map
(`OsmTilesModel::request()` → `osm:collect`), so the map grows as people explore it.

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
A tile takes up to ~25 s longer to collect (up to ~25 Nominatim requests); the queue is not on a
user's path.

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
  list "Be the first" (5 nearest to the centre, with the experience for them). They are
  `getServerSideProps`: one more API call per render, answered from the guest cache for guests and bots.
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
reputation. Champions and "you have been overtaken" notifications (feature 13) come after this.

---

## Step 7: The user page

Depends on step 5. The "Visits" tab (a timeline) shipped in 1.18.0; there is no map of the person.

- **Header:** as now (level, experience, reputation), plus one exploration line: "Opened 19 white
  spots · 41 visits in 23 places · explores 3 regions".
- **One map** of the person, the first block of the overview: their places, the places they visited
  and the white spots they opened, in three tones, the chips "All / Added / Visited" above it. Below
  zoom ~11 the same browser-side hexes as `/map` (`client/utils/hexGrid.ts`,
  `components/map/hex-layer`): a cell is darker the more of its places the person has added or
  visited, the cells where they are the pioneer get a mark. Data from the existing
  `GET /poi?author=` and `GET /poi?visited=` plus the opened spots, cached for guests; the map loads
  when it scrolls into view (`next/dynamic`, `ssr: false`), the ISR render stays without API calls
  for it.
- **Their regions:** for each location they have contributed to: their share ("you have added or
  visited 14% of the known places of Orenburg Oblast"), their place among its explorers
  ("3rd"), and the white spots there. From `GET /users/:id/exploration` (cached, `$ttls` 10 min).
- The "Visited" and "Places" tabs stay as lists for search engines and for people without the map.

Visits are already public (who has been at a place), so the map shows nothing new about a person.

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

- The visit questions: the list and the categories each applies to are a draft
  (`server/app/Config/VisitQuestions.php`).
- XP numbers (+10 for a visit with a contribution, +15 for a white spot) are a starting point.

## Out of scope

GPX tracks; freshness colours of places on the map; filters by visit answers; champions (13);
streaks and challenges (02, 03).

## Docs to update along the way

With steps 5 and 7: `ROADMAP.md` ("Exploration per location", "Personal exploration map") and
`CLAUDE.md`. When nothing is left open, delete this file.
