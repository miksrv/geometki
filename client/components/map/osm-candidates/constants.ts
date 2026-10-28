/** Minimum map zoom for the layer: below it the area is too big */
export const OSM_CANDIDATES_MIN_ZOOM = 11

/** Tiles in one degree: the server collects the candidates by 0.1° tiles (`Config\OsmCandidates::$tileSize`) */
export const OSM_TILES_PER_DEGREE = 10

/** The server answers `tooLarge` for a bigger area, square degrees (`Config\OsmCandidates::$maxRequestArea`) */
export const OSM_CANDIDATES_MAX_AREA = 1

/** Wait until the map stops before asking for the area */
export const OSM_CANDIDATES_DEBOUNCE_MS = 500

/** While tiles of the area are being collected, check for the new candidates this often */
export const OSM_CANDIDATES_POLLING_MS = 30000
