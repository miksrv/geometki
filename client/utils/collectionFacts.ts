const EARTH_RADIUS_KM = 6371

const toRad = (deg: number): number => (deg * Math.PI) / 180

export interface LatLon {
    lat: number
    lon: number
}

/**
 * Great-circle distance between two points on Earth, in kilometers (haversine formula).
 * Used for the collection page's "approximate route length" fact and per-item distance
 * from the previous place in the numbered list.
 */
export const haversineDistanceKm = (a: LatLon, b: LatLon): number => {
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)))
}

export interface CollectionFactsPlace extends LatLon {
    photos?: number
}

export interface CollectionFacts {
    placesCount: number
    photosCount: number
    /** Approximate route length connecting consecutive places in the author's order, in km. */
    routeLengthKm: number
}

/**
 * Derives the collection page's auto-generated "facts" block: number of
 * places, total photos across them, and the approximate route length between consecutive
 * places in the author's order. Computed client-side so it is always in sync with what is
 * displayed, at zero author effort.
 */
export const computeCollectionFacts = (places?: CollectionFactsPlace[]): CollectionFacts => {
    const list = places ?? []

    const photosCount = list.reduce((sum, place) => sum + (place.photos ?? 0), 0)

    let routeLengthKm = 0
    for (let i = 1; i < list.length; i++) {
        routeLengthKm += haversineDistanceKm(list[i - 1], list[i])
    }

    return {
        placesCount: list.length,
        photosCount,
        routeLengthKm: Math.round(routeLengthKm * 10) / 10
    }
}
