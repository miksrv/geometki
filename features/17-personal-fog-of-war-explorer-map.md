# Feature: Personal Fog of War & Explorer Map

> Status: not implemented.

Each authenticated user sees a private exploration map: the world is covered in fog that clears
where they have been. Plus personal exploration stats and an optional "First explorer" mark on
places. The mechanic behind Fog of World, Wandrer and CityStrides.

## What exists today

The site no longer asks for the location on page load: only on the visitor's own action (the map's
"My location" button, sorting places by distance; the "Я здесь был" button). Anonymous visitors'
positions are not stored on the server at all (the client keeps them in the `location` cookie and
sends `lat`/`lon` with the requests that need a distance). For a signed-in user `PUT /location`
saves **one last point**: `users.last_lat`, `last_lon`, `last_location_at`
(`UsersModel::updateLastLocation()`), rewritten only when the user has moved more than
`UsersModel::LOCATION_MIN_DISTANCE` (200 m). It is never returned by the API. There is no position
history: `sessions_history` and the session coordinates were removed (migration
`MoveLocationOffSessions`).

Sources of cleared tiles, then: that last point each time it changes, and "Я здесь был" visits with
coordinates (`users_visited_places.lat/lon`). Without a mobile app coverage will be sparse.

## Location history (to build first)

- Table `users_locations`: `user_id` (`VARCHAR(15)`), `lat`, `lon` (`DECIMAL(10,6)`),
  `created_at`; index `(user_id, created_at)`.
- Written by `UsersModel::updateLastLocation()` in the same place it rewrites the last point, so
  with the same rule: a new row only when the user has moved more than N metres (200 m now) from the
  previous point. No row for anonymous visitors.
- Only with consent (see "Privacy rules" 5): the "Location data" setting must exist before the first
  row is written. Until then only the single last point is kept.

## Privacy rules

1. Personal fog is visible only to its owner. No endpoint exposes another user's tiles or path,
   not even to admins in the UI.
2. Any community aggregate shows a cell only if 10+ distinct users were there.
3. Personal tiles are coarse (zoom 16, ~600 m); community cells at least ~500 m.
4. Community aggregates update once a day, never in real time.
5. Users can view and delete their history and turn recording off (`consent=false` on
   `PUT /location`). Deletion is immediate and resets the fog.
6. "First explorer" never reveals to others who or when.

## Personal fog

- Table `user_explored_tiles`: `user_id` (`VARCHAR(15)`), `tile_z` (16), `tile_x`, `tile_y`,
  `first_seen`; unique `(user_id, tile_z, tile_x, tile_y)`. `first_seen` is never exposed publicly.
- Nightly command: convert new `users_locations` points (and visits with coordinates) to the
  z16 tile plus its 8 neighbours, insert-ignore.
- `GET /users/me/fog?bbox=south,west,north,east`: tiles in the viewport and the total count;
  owner only, cache 1 h.
- Client: `FogOfWarLayer` (world polygon with holes per tile, `interactive: false`), dynamically
  imported like the other map layers; a toggle in the map layer switcher, off by default and shown only
  when the user has at least one tile.

## Stats

- `GET /users/me/stats/exploration`: tiles total / this month, rough km estimate
  (tiles × 0.3 km), number of localities (from the existing location hierarchy), first
  exploration date.
- Profile block "847 tiles · ~254 km · 7 cities" linking to a personal map page with a time filter
  (all / year / month) and a milestones timeline (first tile, new city, 100/500/1000 tiles).
- Possible achievements: tile counts, localities explored, first explorer of N places.

## First explorer

- `places.first_explorer_user_id`, `first_explored_at`.
- Set by the nightly command when a user's point is within 300 m of a place that has none.
- Only the first explorer sees "You were the first to reach this place"; nobody else sees who.

## Community heatmap (optional)

The old "Путешественники" heatmap (`GET /poi/users`, raw session coordinates with no time limit)
was removed as a privacy leak. If a community layer comes back, only as a k-anonymous aggregate: a
nightly `heatmap_grid_cache` (~500 m cells, authenticated users only,
`HAVING COUNT(DISTINCT user_id) >= 10`).

## Data controls

Settings section "Location data": recording toggle, history summary, link to the map,
"Delete all location history" with confirmation. `DELETE /users/me/location-history` removes
tiles, the user's `users_locations` rows and `users.last_lat/last_lon`, clears their
`first_explorer_user_id` marks and revokes related achievements.
