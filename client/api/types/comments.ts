import { ApiModel } from '@/api'

export interface ListResponse {
    items?: ApiModel.Comment[]
    count: number
}

export interface ListRequest {
    place?: string
}

export interface PostRequest {
    placeId?: string
    answerId?: string
    comment?: string
}
