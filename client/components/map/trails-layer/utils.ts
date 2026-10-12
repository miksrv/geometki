import { CRS, LatLngBounds, LatLngTuple, Point } from 'leaflet'

import { WaymarkedRouteSegment } from '@/api/apiWaymarkedTrails'

const toLatLng = ([x, y]: [number, number]): LatLngTuple => {
    const { lat, lng } = CRS.EPSG3857.unproject(new Point(x, y))

    return [lat, lng]
}

/** Every line of the route, in the map's coordinates: the API gives the ways in EPSG:3857 metres */
export const collectRouteLines = (segment?: WaymarkedRouteSegment): LatLngTuple[][] => {
    if (!segment) {
        return []
    }

    if (segment.geometry?.type === 'LineString') {
        return [segment.geometry.coordinates.map(toLatLng)]
    }

    if (segment.geometry?.type === 'MultiLineString') {
        return segment.geometry.coordinates.map((line) => line.map(toLatLng))
    }

    return [...(segment.main ?? []), ...(segment.ways ?? []), ...(segment.appendices ?? [])].flatMap(collectRouteLines)
}

export const bboxToBounds = ([minX, minY, maxX, maxY]: [number, number, number, number]): LatLngBounds =>
    new LatLngBounds(toLatLng([minX, minY]), toLatLng([maxX, maxY]))

/** The API's bbox parameter for a square of `radius` px around a point of the map's container */
export const clickBbox = (
    containerPointToLatLng: (point: Point) => { lat: number; lng: number },
    point: Point,
    radius: number
): string => {
    const southWest = CRS.EPSG3857.project(containerPointToLatLng(new Point(point.x - radius, point.y + radius)))
    const northEast = CRS.EPSG3857.project(containerPointToLatLng(new Point(point.x + radius, point.y - radius)))

    return [southWest.x, southWest.y, northEast.x, northEast.y].map((value) => Math.round(value)).join(',')
}
