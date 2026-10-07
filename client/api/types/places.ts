import { ApiModel, ApiType } from '@/api'

export interface ItemRequest {
    id: string
    lat?: number | null
    lon?: number | null
}

export type ItemResponse = ApiModel.Place

export interface ListRequest {
    sort?: ApiType.SortFieldsType
    order?: ApiType.SortOrdersType
    bookmarkUser?: string
    author?: string
    lat?: number | null
    lon?: number | null
    tag?: string | null
    search?: string
    country?: number | null
    region?: number | null
    district?: number | null
    locality?: number | null
    limit?: number
    offset?: number
    category?: string | null
    excludePlaces?: string[]
}

export interface ListResponse {
    items?: ApiModel.PlaceListItem[]
    count?: number
}

export interface PatchCoverRequest {
    x: number
    y: number
    width: number
    height: number
    placeId: string
    photoId: string
}

export interface PostItemRequest {
    id?: string
    title?: string
    content?: string
    category?: string
    photos?: string[]
    tags?: string[]
    lat?: number
    lon?: number
}

export interface PatchItemResponse {
    content?: string
    tags?: string[]
}

export interface PostItemResponse {
    id: string
}
