import { ApiModel } from '@/api'

export type PoiItemResponse = Pick<
    ApiModel.Place,
    'id' | 'rating' | 'title' | 'views' | 'photos' | 'cover' | 'comments' | 'bookmarks' | 'distance'
>

export interface ListRequest {
    bounds?: string
    zoom?: number
    cluster?: boolean
    categories?: ApiModel.Categories[]
    author?: string
    visited?: string
}

export interface PlacesListResponse {
    items: ApiModel.PlaceMark[]
    count: number
}

export interface PhotosListResponse {
    items: ApiModel.PhotoMark[]
    count: number
}

export interface UsersListResponse {
    items: string[][]
}
