# Feature: Personal Fog of War & Explorer Map

> Status: not implemented.

Each authenticated user sees a private exploration map: the world is covered in fog that clears
where they have been. The cleared area comes from the coordinates the site already records in
`sessions_history` (`PUT /location` → `SessionLibrary::updateLocation()`). Plus personal
exploration stats and an optional "First explorer" mark on places. The mechanic behind Fog of
World, Wandrer and CityStrides.

Caveat: there is no mobile app, so `sessions_history` only gets points while the site is open with
geolocation allowed. Coverage will be sparse; "Я здесь был" visits with coordinates
(`users_visited_places.lat/lon`) are a second source of cleared tiles.

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
- Nightly command: convert new `sessions_history` points (and visits with coordinates) to the
  z16 tile plus its 8 neighbours, insert-ignore.
- `GET /users/me/fog?bbox=south,west,north,east`: tiles in the viewport and the total count;
  owner only, cache 1 h.
- Client: `FogOfWarLayer` (world polygon with holes per tile, `interactive: false`), dynamically
  imported like the heatmap layer; a toggle in the map layer switcher, off by default and shown only
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

The current heatmap (`GET /poi/users`) shows live online-session coordinates. A k-anonymous
alternative: a nightly `heatmap_grid_cache` (~500 m cells, authenticated users only,
`HAVING COUNT(DISTINCT user_id) >= 10`).

## Data controls

Settings section "Location data": recording toggle, history summary, link to the map,
"Delete all location history" with confirmation. `DELETE /users/me/location-history` removes
tiles, the user's `sessions_history` rows and session coordinates, clears their
`first_explorer_user_id` marks and revokes related achievements.
