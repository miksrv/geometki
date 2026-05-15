import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type WikipediaGeoItem = {
    pageid: number
    title: string
    lat: number
    lon: number
    dist: number
}

export type RequestGetByBounds = {
    east: number
    locale: string
    north: number
    south: number
    west: number
}

export type RequestGetExtract = {
    locale: string
    pageid: number
}

export type ResponseGetByBounds = {
    query: {
        geosearch: WikipediaGeoItem[]
    }
}

export type WikipediaThumbnail = {
    source: string
    width: number
    height: number
}

export type WikipediaArticle = {
    pageid: number
    title: string
    extract?: string
    thumbnail?: WikipediaThumbnail
}

export type ResponseGetExtract = {
    query: {
        pages: Record<string, WikipediaArticle>
    }
}

export const APIWikipedia = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://en.wikipedia.org/w/api.php'
    }),
    endpoints: (builder) => ({
        getByBounds: builder.query<ResponseGetByBounds, RequestGetByBounds>({
            query: ({ north, west, south, east, locale }) => ({
                params: {
                    action: 'query',
                    format: 'json',
                    gsbbox: `${north}|${west}|${south}|${east}`,
                    gslimit: 50,
                    gsnamespace: 0,
                    list: 'geosearch',
                    origin: '*'
                },
                url: `https://${locale}.wikipedia.org/w/api.php`
            })
        }),
        getExtract: builder.query<ResponseGetExtract, RequestGetExtract>({
            query: ({ pageid, locale }) => ({
                params: {
                    action: 'query',
                    exintro: true,
                    explaintext: true,
                    format: 'json',
                    origin: '*',
                    pageids: pageid,
                    pithumbsize: 300,
                    prop: 'extracts|pageimages'
                },
                url: `https://${locale}.wikipedia.org/w/api.php`
            })
        })
    }),
    reducerPath: 'APIWikipedia'
})
