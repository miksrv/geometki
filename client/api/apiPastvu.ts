import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type PastvuPhoto = {
    cid: number
    file: string
    title?: string
    dir?: string
    geo: [number, number]
    year?: number
    year2?: number
    s?: number
}

export type PastvuCluster = {
    geo: [number, number]
    c: number
}

export type RequestGetByBounds = {
    geometry: {
        type: 'Polygon'
        coordinates: Array<Array<[number, number]>>
    }
    z: number
    /**
     * Required from zoom 17 (`LOCAL_WORK_ZOOM`): without it PastVu answers with nothing there.
     * With it, every photo of the area comes back, never clustered
     */
    localWork?: 1
    isPainting?: boolean
    year?: number
    year2?: number
}

export type ResponseGetByBounds = {
    result: {
        photos: PastvuPhoto[]
        clusters: PastvuCluster[]
    }
}

export type RequestGetNearest = {
    geo: [number, number]
    /** Meters */
    distance: number
    limit?: number
}

export type ResponseGetNearest = {
    result: {
        photos: PastvuPhoto[]
    }
}

export const APIPastvu = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://api.pastvu.com/api2'
    }),
    endpoints: (builder) => ({
        getByBounds: builder.query<ResponseGetByBounds, RequestGetByBounds>({
            query: (params) => `?method=photo.getByBounds&params=${encodeURIComponent(JSON.stringify(params))}`
        }),
        // The photos around a point, nearest first: the photos that can be linked to a place
        getNearest: builder.query<ResponseGetNearest, RequestGetNearest>({
            query: (params) => `?method=photo.giveNearestPhotos&params=${encodeURIComponent(JSON.stringify(params))}`
        })
    }),
    reducerPath: 'APIPastvu'
})
