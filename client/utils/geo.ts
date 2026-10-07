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

/**
 * Human-readable distance for the map ruler: metres below 1 km, then kilometres with less
 * precision as they grow (1,25 км → 12,4 км → 340 км). Number formatting follows `locale`.
 */
export const formatDistance = (meters: number, locale: string = 'ru'): string => {
    const isRu = locale.startsWith('ru')

    // Rounded first: 999.6 m is shown as 1.00 km, not as 1000 m
    if (Math.round(meters) < 1000) {
        return `${Math.round(meters)} ${isRu ? 'м' : 'm'}`
    }

    const km = meters / 1000
    const digits = km < 10 ? 2 : km < 100 ? 1 : 0
    const value = new Intl.NumberFormat(isRu ? 'ru-RU' : 'en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
    }).format(km)

    return `${value} ${isRu ? 'км' : 'km'}`
}

const EARTH_RADIUS_M = 6378137

/**
 * Area of a polygon on the Earth's surface, square metres (the spherical-excess formula Leaflet.draw
 * uses). The polygon is closed implicitly; fewer than three points have no area.
 */
export const geodesicArea = (points: Array<{ lat: number; lng: number }>): number => {
    if (points.length < 3) {
        return 0
    }

    const sum = points.reduce((acc, p1, index) => {
        const p2 = points[(index + 1) % points.length]

        return acc + toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)))
    }, 0)

    return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2)
}

/**
 * Human-readable area for the map area tool: square metres below 1 ha, hectares below 100 ha
 * (1 km²), then square kilometres. Number formatting follows `locale`.
 */
export const formatArea = (squareMeters: number, locale: string = 'ru'): string => {
    const isRu = locale.startsWith('ru')
    const format = (value: number, digits: number) =>
        new Intl.NumberFormat(isRu ? 'ru-RU' : 'en-US', {
            maximumFractionDigits: digits,
            minimumFractionDigits: digits
        }).format(value)
    const precision = (value: number) => (value < 10 ? 2 : value < 100 ? 1 : 0)

    // Each unit is picked by the rounded value: 9 999.7 m² is shown as 1.00 ha, not as 10 000 m²
    if (Math.round(squareMeters) < 10_000) {
        return `${format(Math.round(squareMeters), 0)} ${isRu ? 'м²' : 'm²'}`
    }

    const ha = squareMeters / 10_000
    if (Number(ha.toFixed(precision(ha))) < 100) {
        return `${format(ha, precision(ha))} ${isRu ? 'га' : 'ha'}`
    }

    const km2 = squareMeters / 1_000_000
    return `${format(km2, precision(km2))} ${isRu ? 'км²' : 'km²'}`
}
