import { ApiModel } from '@/api'

export interface ListResponse {
    items: ApiModel.User[]
    verified_count: number
    total_count: number
}

export interface PutRequest {
    place: string
    lat?: number
    lon?: number
}

export interface PutResponse {
    visited: boolean
    verified: boolean
}

export interface CheckRequest {
    placeId: string
}

export interface CheckResponse {
    result: boolean
}
