import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

/** A Waymarked Trails map: its own subdomain and data set */
export type WaymarkedTrailsMap = 'hiking' | 'cycling' | 'slopes'

export type WaymarkedRouteItem = {
    type: 'relation' | 'wayset' | 'way'
    id: number
    name?: string
    ref?: string
    group?: string
    symbol_id?: string
}

/** A node of the route tree: routes and their parts down to the ways, which carry the geometry */
export type WaymarkedRouteSegment = {
    route_type: string
    length?: number
    main?: WaymarkedRouteSegment[]
    ways?: WaymarkedRouteSegment[]
    appendices?: WaymarkedRouteSegment[]
    geometry?:
        | { type: 'LineString'; coordinates: Array<[number, number]> }
        | { type: 'MultiLineString'; coordinates: Array<Array<[number, number]>> }
}

export type WaymarkedRouteDetails = WaymarkedRouteItem & {
    // EPSG:3857 metres, like every coordinate of the API
    bbox?: [number, number, number, number]
    description?: string
    operator?: string
    url?: string
    route?: WaymarkedRouteSegment
}

export type RequestGetByArea = {
    map: WaymarkedTrailsMap
    // minX,minY,maxX,maxY in EPSG:3857 metres
    bbox: string
    locale: string
}

export type ResponseGetByArea = {
    results: WaymarkedRouteItem[]
}

export type RequestGetRelation = {
    map: WaymarkedTrailsMap
    id: number
    locale: string
}

export const waymarkedTrailsHost = (map: WaymarkedTrailsMap) => `https://${map}.waymarkedtrails.org`

export const APIWaymarkedTrails = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://hiking.waymarkedtrails.org/api/v1'
    }),
    endpoints: (builder) => ({
        getByArea: builder.query<ResponseGetByArea, RequestGetByArea>({
            query: ({ map, bbox, locale }) => ({
                params: { bbox, limit: 10, locale },
                url: `${waymarkedTrailsHost(map)}/api/v1/list/by_area`
            })
        }),
        getRelation: builder.query<WaymarkedRouteDetails, RequestGetRelation>({
            query: ({ map, id, locale }) => ({
                params: { locale },
                url: `${waymarkedTrailsHost(map)}/api/v1/details/relation/${id}`
            })
        })
    }),
    reducerPath: 'APIWaymarkedTrails'
})
