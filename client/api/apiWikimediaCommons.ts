import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type WikimediaGeoItem = {
    pageid: number
    title: string
    lat: number
    lon: number
    dist: number
}

export type ResponseGetByBounds = {
    query: {
        geosearch: WikimediaGeoItem[]
    }
}

export type RequestGetByBounds = {
    north: number
    south: number
    east: number
    west: number
}

export type WikimediaImageInfo = {
    url: string
    thumburl?: string
    descriptionurl: string
}

export type WikimediaPage = {
    pageid: number
    title: string
    imageinfo?: WikimediaImageInfo[]
}

export type ResponseGetImageInfo = {
    query: {
        pages: Record<string, WikimediaPage>
    }
}

export const APIWikimediaCommons = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://commons.wikimedia.org/w/api.php'
    }),
    endpoints: (builder) => ({
        getByBounds: builder.query<ResponseGetByBounds, RequestGetByBounds>({
            query: ({ north, west, south, east }) => ({
                params: {
                    action: 'query',
                    format: 'json',
                    gsbbox: `${north}|${west}|${south}|${east}`,
                    gslimit: 50,
                    gsnamespace: 6,
                    list: 'geosearch',
                    origin: '*'
                },
                url: ''
            })
        }),
        getImageInfo: builder.query<ResponseGetImageInfo, string>({
            query: (title) => ({
                params: {
                    action: 'query',
                    format: 'json',
                    iiprop: 'url',
                    iiurlwidth: 1280,
                    origin: '*',
                    prop: 'imageinfo',
                    titles: title
                },
                url: ''
            })
        })
    }),
    reducerPath: 'APIWikimediaCommons'
})
