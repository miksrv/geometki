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
    /** A location slug (any level) — see `GET /locations/resolve`. Applied in addition to the id-based params above */
    location?: string | null
    limit?: number
    offset?: number
    /** A single category name, or several joined with a comma (features/20-location-seo-pages.md: 2+ categories stay a query param) */
    category?: string | null
    excludePlaces?: string[]
}

export interface ListResponse {
    items?: ApiModel.PlaceListItem[]
    count?: number
}

/** The crop box in the image pixels; the source is an uploaded photo or a linked one */
export interface PatchCoverRequest {
    x: number
    y: number
    width: number
    height: number
    placeId: string
    photoId?: string
    /** A linked Wikimedia Commons or PastVu photo (`Photo.id` of an `external` photo) */
    externalPhotoId?: string
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
    /** OSM candidate the place is created from: links them and hides the candidate from the map */
    candidate?: string
}

export interface PatchItemResponse {
    content?: string
    tags?: string[]
}

export interface PostItemResponse {
    id: string
}
