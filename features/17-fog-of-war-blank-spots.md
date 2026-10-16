# Feature: Fog of War — Blank Spots

> Status: not implemented.

One fog for everybody over the map: it lies where something worth marking is known but there is no
place on Geometki yet. A published place clears its cell. The first author in a cell becomes its
pioneer. The fog gives a reason to look around the map — find blank spots near you or on a trip and
fill them — and it works for content growth, not for time spent on the site.

Built from public data only: published places and OSM/Wikidata candidates. No user coordinates,
no location history, no personal fog.

## Cells

- A fixed grid of `0.02°` cells (`Config\Fog::$cellSize`): 5 × 5 cells per OSM candidates tile
  (`OsmCandidates::$tileSize = 0.1`), so a collected tile updates exactly 25 cells. ~2.2 × 1.3 km
  at 55° N.
- A cell id is the integer pair `cell_lat = floor(lat / cellSize)`, `cell_lon = floor(lon / cellSize)`.
- Three states:

| State | Condition | On the map |
|-------|-----------|------------|
| Open | at least one published place | clear |
| Fog | no places, at least one candidate with potential | fog |
| Neutral | nothing known: empty land, water, or a tile not collected yet | clear, not counted |

- Potential: a candidate in the groups "Хорошо описанные" or "Неисследованные" of the
  `/osm-candidates` legend (same score thresholds); "Прочие объекты" do not count. Candidates
  never clear the fog — they only say a cell is worth opening.
- Neutral cells are not fogged on purpose: taiga, steppe and sea would otherwise stay closed
  forever and push people to mark "just a field".

## Data

**Table `fog_cells`** — only cells that are open or fogged (sparse):

```sql
cell_lat INT, cell_lon INT,               -- PK (cell_lat, cell_lon)
places_count SMALLINT,                    -- published, not deleted
potential_count SMALLINT,                 -- candidates with potential
region_id, locality_id,                   -- for the percentages, see "Open questions"
pioneer_user_id VARCHAR(15) NULL,
pioneer_place_id VARCHAR(15) NULL,
opened_at DATETIME NULL,                  -- created_at of the pioneer place
pioneer_confirmed_at DATETIME NULL,
pioneer_xp SMALLINT NULL,
updated_at DATETIME
-- index (region_id), (locality_id), (pioneer_user_id, opened_at)
```

A row with `places_count = 0` and `potential_count = 0` is deleted.

**Updates** — `FogLibrary::recountCell(lat, lon)`, one indexed `COUNT` over the cell bbox:

- Place created, deleted, restored or moved (old and new cell) — from the same places where
  `ActivityLibrary` is called.
- `osm:collect` marks a tile done → recount its 25 cells.
- `osm:rescore`, changes to the potential rule or to `cellSize` → `php spark fog:rebuild`.

## Pioneer

- The pioneer of a cell is the author of its oldest non-deleted place. Recomputed on every recount:
  if that place is deleted, the next oldest takes over; if none is left, the cell closes again.
- Service accounts (`Notifications::$serviceEmailDomains`, bulk imports from `tools/places`) open
  cells but are never pioneers and are not in the leaderboards; the pioneer is then the first real
  author, if any.
- Confirmation: the nightly `fog:confirm` sets `pioneer_confirmed_at` once the place is
  `pioneerConfirmDays` (14) old and has a photo. Only then the XP counts.
- XP: `pioneer_xp = pioneerBaseXp + remote bonus`, where the bonus grows with the distance to the
  nearest other place (capped, e.g. +0 under 5 km … +50 over 30 km). A remote waterfall is worth more
  than a cell next to ten others. Fixed at confirmation.
- `LevelsLibrary::calculate()` adds `SUM(pioneer_xp)` of the user's confirmed cells, like the
  achievement bonuses, so a lost pioneer status takes the XP back on the next recount.
- Achievements: pioneer of 1 / 10 / 50 / 100 cells.

## Rendering

- Server raster tiles: `GET /fog/{z}/{x}/{y}.png` (GD), transparent where clear, a soft fog fill
  over fogged cells. Rendered from `zoomMin` (8) — below it the grid is smaller than a pixel, no fog.
- File cache in `writable/cache/fog/{z}/{x}/{y}.png`; `recountCell()` deletes the cached tiles
  that cover the cell when its state changes. HTTP `Cache-Control: max-age=3600`.
- Client: a plain `TileLayer` in the map layer switcher ("Туман"), like the other layers. No
  per-cell geometry in the browser, so the cost on the client is one more tile layer.
- With both layers on, candidates inside fogged cells are drawn highlighted: they are the way to
  open the cell.

## Numbers

Percent is always of what can be opened, never of the world:
`open / (open + fog)` cells of an area.

- Location landing pages (`/places/{location}`) and the region block: "Открыто 34% · 120 из 352".
- Profile: "Первооткрыватель 41 клетки", the list of cells links to the places.
- Leaderboard of the week: cells opened this week by the current pioneer (confirmed or not — an
  unconfirmed one drops out if its place is deleted), region filter when 13 is built.
- Feed and digest (optional, with 16): "opened a new cell near Sol-Iletsk".

## API

- `GET /fog/{z}/{x}/{y}.png` — the layer.
- `GET /fog/stats?region=&locality=` — open / fog counts and the percent; also embedded in the
  location landing responses.
- `GET /fog/leaders?period=week|month|all&region=` — pioneers by opened cells.
- `GET /users/{id}` — `pioneerCells` in the user stats.

## Config `Config\Fog`

`cellSize`, `zoomMin`, `pioneerConfirmDays`, `pioneerNeedsPhoto`, `pioneerBaseXp`, the remote bonus
steps, the potential groups.

## Open questions

- **Areas of a cell.** Places carry `region_id`/`locality_id`, candidates do not. Options: geocode
  the cell centre once when its row is created (the existing geocoder, nightly, cached per cell), or
  take the area of the nearest place. A cell on a border belongs to one area.
- **Potential sources.** Start with OSM/Wikidata candidates. Possibly later: Wikipedia articles with
  coordinates and settlements, if candidates alone leave too many real blank spots neutral.
- **Fog density.** Optional later: a light haze for an open cell that still has many unmatched
  candidates, so a second place there is worth something too.
- **Default visibility.** The layer is off by default at first; turn it on by default for signed-in
  users if it proves to be the hook.
