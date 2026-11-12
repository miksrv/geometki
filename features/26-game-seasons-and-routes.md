# Feature 26: The Game — Seasons and Routes

> Status: concept, agreed in discussion on 2026-11-10; not implemented, no numbers fixed.
> Replaces the "Locations of candidates" part and the explored formula of step 5 of
> `25-visits-and-exploration.md` (see "Exploration"). The open questions are at the end.

The site gets a section "Game" that answers "what do I do here": visit interesting places and
prove it. The game has two separate mechanics and entities:

- **Seasons** — automatic, for everyone, everywhere: confirmed visits of places give season points.
- **Routes** — made by hand, local: walk a route and confirm each of its points.

Both stand on one thing, the **confirmed visit**. Adding places moves to the second plan: the
main call of the site is "visit and confirm"; a new place is a move inside the game (it widens
the field), not the goal.

## Why this and not something else

- trekkingmania.ru: a catalogue of ~1100 tasks written by the organisers, a photo with a plate
  as the proof, points set by hand and not published, an all-time rating nobody can catch up
  with. We do not repeat the plate, the hand-made task list and the all-time rating.
- Of the three known kinds of proof — GPS in a native app (Ingress, Turf, Swarm), a physical
  artefact (Geocaching, Munzee, the plate), the contribution itself (Geograph, StreetComplete,
  iNaturalist) — ours is the third: the fresh photo of the place is both the proof and the
  content.
- The game must be playable by one person: for now the only active player is the owner.

## The confirmed visit

"Я здесь был" stays as it is: one tap, no location asked, a log with one visit a week, no
points for a bare visit. A visit is **confirmed** in one of two ways:

| Way | When | Gives |
|---|---|---|
| A photo with EXIF: shot date and GPS near the place | nature without a connection, upload at home | the base points + the photo bonus |
| "I am here": one geolocation request on the visitor's tap, on the spot | routes in a city | the base points |

- The photo decides, not the button: a photo shot within the season and near the place confirms
  the place whenever it is uploaded (until the season is closed, plus a few days of grace). If
  there is no visit of that day, the photo makes one on its shot day.
- A visit made before the season does not count and does not block: the shot date must be
  within the season.
- The photo must show the place. No person, no plate, no number. The rules ask for a phone
  photo with GPS on; landscape is a recommendation, not a condition.
- "Near" is a radius per category (a monument: 200–300 m; a lake, a ridge, a reserve:
  kilometres), in a config like the visit questions.
- The coordinates of "I am here" are compared and dropped: only the fact is stored. It is asked
  on the visitor's action, as the rule of the visitor location says.
- EXIF and geolocation can be forged. With no real prizes that is accepted; a "report" button
  on a confirmation covers disputes.

Already there: `PhotoLibrary` reads the GPS position of an uploaded photo. Missing: the shot
date, the comparison with the place, the confirmation on the visit.

## Seasons

Fully automatic: nothing is created by hand but the pictures of the awards.

- A season is a calendar period (three months or longer), its bounds come from the calendar. It
  starts and closes by itself.
- A place counts **once a season** for a person.
- **Points** for a confirmed place: the base, times the category (a rare one is worth more),
  plus the bonus of a white spot (a place made from a candidate in this season with the
  author's own fresh photo; kept moderate so that junk places do not pay).
- **Popularity within the season lowers the value**: the more people confirmed the place this
  season, the less the next one gets. Proposed form: a bonus to the first ones (the first ×2,
  the second to the fifth ×1.5, then ×1) rather than a cut for the late ones. How long nobody
  has been at the place can raise the value too (capped), meaningful from the second season on.
- The formula is public: the value of a place is shown on its card and on the map.
- A season may have **conditions**: e.g. at least 10 places of a category, a theme category
  with more points.
- **Awards** are achievements of the existing type `seasonal` (`season_start`, `season_end`):
  one award for taking part in the season (with a threshold, so one tap is not enough), drawn
  by the owner; a default picture with the season's name if none is ready. Places 1, 2, 3 are
  shown at the end and may get their own awards.
- **The season score resets; the history stays.** Closing a season (a cron command) freezes
  the table — who got how many points, who won — so a photo deleted later does not rewrite it.
  Every past season has its page.
- The total experience and the levels are not reset and not replaced by the season score.

## Routes

Made by hand by the owner (later a few more people). The acquisition tool: a concrete thing to
announce, first in the owner's Telegram channel, then in the local media. First routes: Orenburg,
the main street (monuments, historical buildings), a themed one for the astronomy channel.

- A route is an ordered list of **existing places of the site**: 6–10 points, 1–2 km, 40–60
  minutes. The length is the sum of the straight lines between the points; no road routing.
- Confirming a point makes an ordinary visit, so it also counts in the season, in the
  exploration and in the feed. On a route the main way is "I am here"; a photo works too.
- Three modes:
  1. **Open** — all the points are seen.
  2. **Step by step** — the length and the first point are seen; confirming a point opens the
     next one.
  3. **Riddles** — a hint or a photo instead of the point; the person finds the place and
     confirms being near it, which opens the next riddle.
- Not a competition and not on time: a quest everyone walks when they want (the Encounter idea
  without teams and timers).
- Walking a route to the end gives a fixed bonus and an award (an achievement with a new
  metric).
- **Not a kind of collection.** A collection is a public cached page that sends all its places;
  the next point of a closed route must not get into the API, the HTML or the sitemap. Own
  tables: the route (mode, texts), its points (place, position, hint, hint photo), the walk
  (who, which point, when).
- In the riddle mode the visits of its points are kept out of the feed and the visitors of a
  place until the walk is over: they would give the answer away.

## Exploration

Changes step 5 of feature 25.

- **Explored** is a person's share of the places of a location: any visit (confirmed or not)
  and the places they added, of all the published places there. Never reset; it grows with the
  visits and falls when new places are added.
- Only added places count. OSM candidates stay hints: the white spots of the map and
  suggestions for new places. They get no locations, so the reverse geocoding of candidates in
  step 5 is not needed.
- Counted on every level the places already have: `locality_id`, `district_id`, `region_id`,
  `country_id`. Nature places outside settlements have no locality and count from the district
  up. Where a location has fewer than five places, "2 of 2" is shown instead of a percentage.
- Location pages show the statistics of the location (places, visited this season, who explores
  it); the profile shows the person's percentages.
- A home city is not needed for the numbers. By default the region with most of the person's
  visits goes first; a choice in the settings (through the geocoder, so a new locality is added
  as it is for a place, by its OSM id) comes with the regional leaderboards.

## The "Game" section

One page, shipped together with the mechanics (leaderboards alone explain nothing):

1. The rules in three steps and the public table of points.
2. The routes.
3. The current season: its conditions, the valuable places nearby, the rating, the own score.
4. The past seasons.

## What it stands on

| Need | Already there | New |
|---|---|---|
| Visits | the log, `VisitsLibrary`, activity, the feed | the confirmation of a visit |
| Photo proof | GPS read from EXIF (`PhotoLibrary`) | the shot date, the radius per category |
| Season awards | achievements of the type `seasonal`, visit metrics | metrics: confirmed places, by category, season points, route walked |
| Season results | the activity log, cron commands | the frozen results of a closed season, the closing command |
| Routes | places, visits, sign-in by Google, Yandex, VK and a mail link | the route, its points, the walk; the page of a walk |
| Exploration | the location ids of places, visits | the counts per location and per person |

## Order of work

1. Routes, the open and the step-by-step modes, with "I am here" and the award. Walk each
   route on Android and on an iPhone before announcing it.
2. The season: confirmation by photo, points, the award, the history, the section "Game".
3. The riddle mode of routes.

## Launch

- **Shipped in parts, closed.** The new sections and mechanics go to production step by step
  and are available only to the administrator's account (`role` = `admin`): no links, pages,
  API answers, awards or feed stories of the game for anyone else until the launch. Nothing of
  it in the sitemap or the changelog before that.
- **Tested first.** Before the launch everything is walked through on the administrator's
  account, on Android and on an iPhone: the routes, the confirmations, the season, the awards.
- **Ready at the launch:** the section "Game" with the description of the game, its mechanics
  and the table of points; the award pictures; the first route.
- **The first route is "Space Orenburg"** (the places of Gagarin and of cosmonautics in the
  city). The launch is announced by it: an advertisement in the owner's astronomy Telegram
  channel, the local media after that.
- **The launch opens the game to everyone**, possibly in January 2027. The first season may
  be a short one of two months, January and February 2027. By then the owner adds about 2000
  more places to the map, so that there is a field to play on.

## Award pictures

The medals are replaced by our own format, many different pictures in one style, as the badges
of Ingress are. Chosen on 2026-11-10 out of three generated sheets: the **enamel pin**.

- **Shape:** one hexagon for every award (a cell of the hex layer of the map), a point up.
- **Rim = tier:** bronze, silver, gold; dark steel for an award without a tier (a season, a route).
- **Field colour = group:** exploration — deep blue, content — teal, social — raspberry,
  reputation — purple, consistency — forest green, routes — orange; a season by its time of
  year (winter — light blue, spring — fresh green, summer — coral, autumn — amber).
- **Symbol:** one large cream symbol with navy details. The three tiers of a group are three
  different pictures of one subject, richer with each tier.
- **Text:** none, except the year on a season award (a small band at the bottom).
- **Every award has its own picture**, the base ones too: no two awards share a symbol, and
  the main silhouettes do not repeat across groups (a star belongs to `critic`, a shield to
  `trusted`, a flame to `streak`, and so on). A new award takes a subject from the reserved
  list below or a new one, never a taken one.
- Shown at 40 px on the light and the dark theme: no fine detail, no glow. Generated on a
  white background, cut out afterwards.

### Prompt: the three tiers of a group

One chat per group, the chosen sheet (`2.png`) attached as the reference; the three values in
brackets come from the table below.

```
Generate an image right away, do not ask clarifying questions.

Using exactly the style of the attached badges (hard enamel pin, the same
pointy-top hexagon, rim width and line weight), draw 3 new achievement badges
in one row, as a consistent series: the three tiers of one achievement.

Style: hard enamel pin badge. Flat fields of solid colour separated by thin
raised metal lines. A plain field inside the hexagon without any pattern.
ONE large central symbol filling about 60% of the badge, cream (#f6ead0)
with dark navy (#12284a) details. No text, no letters, no numbers.

Field colour of all three: [FIELD COLOUR].
Rims, left to right: bronze, silver, gold. The metal lines of each badge
match its rim.
Symbols, left to right — the same subject, richer with each tier:
1. [BRONZE SYMBOL]
2. [SILVER SYMBOL]
3. [GOLD SYMBOL]

Must stay readable when shrunk to 40x40 pixels: high contrast, no fine detail.
Plain solid white background behind the badges, nothing else on the canvas:
no glow, no halo, no shadows, no vignette. Identical size, even spacing,
front view. Landscape image, 1536x1024.
```

| Group (`group_slug`) | Field colour | Bronze | Silver | Gold |
|---|---|---|---|---|
| `explorer` | deep blue (#1f5a9e) | a map pin | a map pin on a folded map | a map pin on a globe |
| `trailblazer` | deep blue (#1f5a9e) | one boot print | a signpost with two arrows | a mountain peak with a flag on top |
| `photographer` | teal (#1b8a8f) | a compact camera | a photo card with a mountain and a sun | a camera aperture iris |
| `curator` | teal (#1b8a8f) | a pencil | an open notebook with a pencil | a quill in an inkwell |
| `critic` | raspberry (#b83260) | one star | a speech bubble with a star inside | a star with a small crown above it |
| `trusted` | purple (#6a4aa5) | a handshake | a shield with a check mark | a shield between two laurel branches |
| `veteran` | purple (#6a4aa5) | one chevron | two chevrons | three chevrons with a diamond above |
| `regular` | forest green (#2f7d4f) | a calendar page | a stack of calendar pages | a calendar page with a rising sun |
| `streak` | forest green (#2f7d4f) | a small flame | a tall double flame | a flame with a lightning bolt inside |

Reserved for the awards of the game, not to be used by the base ones:

- **Seasons:** a snowflake (winter), a sprout (spring), a sun over water (summer), an oak leaf
  (autumn), each with the year; the theme of a season may add its own subject.
- **Routes:** a dotted line with points under a landmark of the route (a tower, a monument, a
  rocket for the space route): every route has its own landmark.
- **Exploration of a location:** a compass, a hexagon grid filling up, a spyglass.
- **Confirmed visits:** a map pin with a check mark, a tent, a backpack, binoculars.

### Prompt: one award (a season, a route, anything new)

```
Generate an image right away, do not ask clarifying questions.

Using exactly the style of the attached badges (hard enamel pin, the same
pointy-top hexagon, rim width and line weight), draw ONE new badge.
Field colour: [FIELD COLOUR]. Rim and metal lines: [dark steel / bronze /
silver / gold]. Central symbol, cream with dark navy details: [SYMBOL].
[For a season: a small band across the bottom of the hexagon with the
digits "2026" in a bold sans-serif, no other text.] No other text.
Readable at 40x40 pixels, no fine detail. Plain solid white background,
no glow, no halo, no shadows. The badge centred with a small margin,
square image, 1024x1024.
```

## Open questions

- The year on the award of a winter season, which spans two years: "2026/27" or the year it
  starts in.

- Does a browser pass the GPS of a photo? As far as known, Chrome on Android drops it when the
  photo is picked through the system gallery, iOS depends on an option of the picker. To be
  tested on real phones before the photo confirmation is built.
- A photo with the date and without GPS: the owner's manual approval, or only "I am here"?
- The length of a season after the first one (January and February 2027, see "Launch"): by the
  seasons of the year or another rhythm.
- All the numbers: the base, the category weights (from the share of the category or set by
  hand), the bonus to the first ones, the cap of the "long unvisited" factor, the threshold of
  the season award.
- Whether a route can be started without an account, with the sign-in asked at the first point.
