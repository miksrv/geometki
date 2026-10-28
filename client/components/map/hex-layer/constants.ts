import { OSM_CANDIDATES_MIN_ZOOM } from '../osm-candidates/constants'

/** From this zoom the points show as they are, below it the hexagons take their place */
export const HEX_MAX_ZOOM = OSM_CANDIDATES_MIN_ZOOM

/**
 * Leaflet paints from values (see DESIGN.md). The three states of a cell's points, mixed into one
 * fill by their shares (`hexFill`): the pale green of the places nobody has added yet (the open
 * candidates), the green of the places on the map, the project main colour of the places the
 * visitor has been to. All three have a hue: a guest sees a map of green, not of grey
 */
export const HEX_SPOT_COLOR = '#d4ece0'
export const HEX_PLACE_COLOR = '#2f9e77'
export const HEX_VISITED_COLOR = '#3770b1'
/** The edge of a cell: the pale green needs one to be seen on the light tiles */
export const HEX_EDGE_COLOR = '#24785b'
