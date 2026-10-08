import { ApiModel } from '@/api'

export type PoiItemResponse = Pick<
    ApiModel.Place,
    'id' | 'slug' | 'rating' | 'title' | 'views' | 'photos' | 'cover' | 'comments' | 'bookmarks' | 'distance'
> & {
    /** Present only for signed-in users: whether the place is in their bookmarks */
    bookmarked?: boolean
}

export interface ListRequest {
    bounds?: string
    zoom?: number
    cluster?: boolean
    categories?: ApiModel.Categories[]
    author?: string
    visited?: string
    /** User ID: places in their bookmarks */
    bookmarks?: string
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
