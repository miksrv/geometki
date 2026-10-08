import type { LatLngBounds } from 'leaflet'

export type BoundsTuple = [south: number, west: number, north: number, east: number]

/** Bounds rounded outwards to 0.01°, so that small pans ask for the same area and hit the RTK cache */
export const roundBoundsOutwards = (bounds: LatLngBounds, precision = 100): BoundsTuple => [
    Math.floor(bounds.getSouth() * precision) / precision,
    Math.floor(bounds.getWest() * precision) / precision,
    Math.ceil(bounds.getNorth() * precision) / precision,
    Math.ceil(bounds.getEast() * precision) / precision
]

const EARTH_RADIUS = 6371008.8

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * Area of the bounds in square meters, the way the GeoData extension measures it:
 * the height along a meridian times the width along the middle parallel
 */
export const boundsAreaMeters = (bounds: LatLngBounds): number => {
    const height = toRadians(bounds.getNorth() - bounds.getSouth()) * EARTH_RADIUS
    const middleLatitude = (bounds.getNorth() + bounds.getSouth()) / 2
    const width = toRadians(bounds.getEast() - bounds.getWest()) * EARTH_RADIUS * Math.cos(toRadians(middleLatitude))

    return height * width
}

/** `MaxGeoSearchRadius` of Wikipedia and Wikimedia Commons, meters */
export const GEOSEARCH_MAX_RADIUS = 10000

/**
 * The geosearch of Wikipedia and Wikimedia Commons (the GeoData extension) answers `toobig`
 * (HTTP 200 with an error body, no results) for an area over 4 × MaxGeoSearchRadius²,
 * about 20 × 20 km, so such an area is not asked at all
 */
export const isGeoSearchTooBig = (bounds: LatLngBounds): boolean =>
    // A little below the limit: the radius of the Earth used by GeoData may differ slightly
    boundsAreaMeters(bounds) > 4 * GEOSEARCH_MAX_RADIUS * GEOSEARCH_MAX_RADIUS * 0.98
