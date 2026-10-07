const EARTH_RADIUS_KM = 6371

const toRad = (deg: number): number => (deg * Math.PI) / 180

export interface LatLon {
    lat: number
    lon: number
}

/**
 * Great-circle distance between two points on Earth, in kilometers (haversine formula).
 * Used for the "distance from you" stat in search results.
 */
export const haversineDistanceKm = (a: LatLon, b: LatLon): number => {
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)))
}
