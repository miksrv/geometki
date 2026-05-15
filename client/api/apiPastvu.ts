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

export const APIPastvu = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://api.pastvu.com/api2'
    }),
    endpoints: (builder) => ({
        getByBounds: builder.query<ResponseGetByBounds, RequestGetByBounds>({
            query: (params) => `?method=photo.getByBounds&params=${encodeURIComponent(JSON.stringify(params))}`
        })
    }),
    reducerPath: 'APIPastvu'
})
