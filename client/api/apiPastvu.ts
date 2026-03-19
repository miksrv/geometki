import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Photo = {
    s: number
    cid: number
    file: string
    title?: string
    dir?: string
    geo: number[]
    year?: number
    year2?: number
}

export type RequestNearestGetPhotos = {
    lat: number
    lon: number
}

export type ResponseNearestGetPhotos = {
    result: {
        photos: Photo[]
    }
}

export const APIPastvu = createApi({
    baseQuery: fetchBaseQuery({
        baseUrl: 'https://pastvu.com/api2'
    }),
    endpoints: (builder) => ({
        nearestGetPhotos: builder.query<ResponseNearestGetPhotos, RequestNearestGetPhotos>({
            query: ({ lat, lon }) => `?method=photo.giveNearestPhotos&params={"geo":[${lat},${lon}],"limit":30}`
        })
    }),
    reducerPath: 'APIPastvu'
})
