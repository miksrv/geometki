export interface MapPoint {
    lat: number
    lon: number
}

export type MapBounds = [[number, number], [number, number]]

interface MapView {
    center: [number, number]
    zoom: number
    /** Set for two or more points: the map fits them exactly instead of using center/zoom */
    bounds?: MapBounds
}

const DEFAULT_VIEW: MapView = { center: [55.751244, 37.618423], zoom: 5 }

/**
 * Initial viewport of the search map. No points: the default view; one point: centred
 * on it at street level; several: their bounding box, fitted by Leaflet (`fitBounds`), so
 * every result is in the frame whatever the map size.
 */
export const computeMapView = (points: MapPoint[]): MapView => {
    const valid = points.filter((p) => p.lat != null && p.lon != null)

    if (!valid.length) {
        return DEFAULT_VIEW
    }

    if (valid.length === 1) {
        return { center: [valid[0].lat, valid[0].lon], zoom: 13 }
    }

    const lats = valid.map((p) => p.lat)
    const lons = valid.map((p) => p.lon)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)

    return {
        bounds: [
            [minLat, minLon],
            [maxLat, maxLon]
        ],
        center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
        zoom: 13
    }
}
