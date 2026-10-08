import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type WikimediaImageInfo = {
    url: string
    width?: number
    height?: number
    /** A copy scaled down to the requested width; the original itself when it is smaller */
    thumburl?: string
    thumbwidth?: number
    thumbheight?: number
    descriptionurl?: string
    /** BITMAP and DRAWING are pictures; AUDIO, VIDEO, OFFICE and others are not */
    mediatype?: string
}

export type WikimediaPage = {
    pageid: number
    title: string
    /** Position in the geosearch results (nearest to the bounds' center first) */
    index?: number
    coordinates?: Array<{ lat: number; lon: number }>
    imageinfo?: WikimediaImageInfo[]
}

export type ResponseGetByBounds = {
    query?: {
        pages?: Record<string, WikimediaPage>
    }
}

export type RequestGetByBounds = {
    north: number
    south: number
    east: number
    west: number
}

export type RequestGetNearby = {
    lat: number
    lon: number
    /** Meters, up to 10 000 */
    radius: number
}

export const APIWikimediaCommons = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://commons.wikimedia.org/w/api.php'
    }),
    endpoints: (builder) => ({
        // One request for the files in the bounds together with their coordinates and image
        // links, so the lightbox can scroll through every photo of the visible area
        getByBounds: builder.query<ResponseGetByBounds, RequestGetByBounds>({
            query: ({ north, west, south, east }) => ({
                params: {
                    action: 'query',
                    colimit: 'max',
                    format: 'json',
                    generator: 'geosearch',
                    ggsbbox: `${north}|${west}|${south}|${east}`,
                    ggslimit: 50,
                    ggsnamespace: 6,
                    iiprop: 'url|size',
                    iiurlwidth: 1280,
                    origin: '*',
                    prop: 'imageinfo|coordinates'
                },
                url: ''
            })
        }),
        // The files around a point, nearest first: the photos that can be linked to a place
        getNearby: builder.query<ResponseGetByBounds, RequestGetNearby>({
            query: ({ lat, lon, radius }) => ({
                params: {
                    action: 'query',
                    colimit: 'max',
                    format: 'json',
                    generator: 'geosearch',
                    ggscoord: `${lat}|${lon}`,
                    ggslimit: 50,
                    ggsnamespace: 6,
                    ggsradius: radius,
                    iiprop: 'url|size|mediatype',
                    iiurlwidth: 1280,
                    origin: '*',
                    prop: 'imageinfo|coordinates'
                },
                url: ''
            })
        })
    }),
    reducerPath: 'APIWikimediaCommons'
})
