import { ApiModel } from '@/api'

export interface ListResponse {
    rating?: number
    count?: number
    vote?: number | null
}

export interface PutRequest {
    place: string
    score: number
}

export interface PutResponse {
    rating: number
}

export interface HistoryRequest {
    placeId?: string
    userId?: string
}

export interface HistoryResponse {
    count?: number
    items?: ApiModel.RatingHistory[]
}
