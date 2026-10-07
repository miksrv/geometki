import { ApiModel } from '@/api'

export type SortType = 'updated' | 'popular'

export interface ListRequest {
    region?: number
    author?: string
    placeId?: string
    sort?: SortType
    limit?: number
    offset?: number
}

export interface ListResponse {
    items?: ApiModel.Collection[]
    count?: number
}

export type ItemResponse = ApiModel.Collection

export interface CreateRequest {
    title: string
    description?: string
    region?: number
}

export interface CreateResponse {
    id: string
    slug: string | null
}

export interface PatchRequest {
    id: string
    title?: string
    description?: string | null
    region?: number | null
}

export interface AddPlacesRequest {
    id: string
    placeIds: string[]
}

export interface AddPlacesResponse {
    added: string[]
    skipped: string[]
    placesCount: number
}

export interface RemovePlaceRequest {
    id: string
    placeId: string
}

export interface ReorderRequest {
    id: string
    order?: string[]
    placeId?: string
}

export interface MembershipRequest {
    placeId?: string
}

export interface MembershipItem {
    id: string
    title: string
    placesCount: number
    cover?: { full?: string; preview: string } | null
    contains: boolean
}

export interface MembershipResponse {
    items: MembershipItem[]
}

export interface RecommendedRequest {
    id: string
    limit?: number
}

export interface RecommendedResponse {
    items: ApiModel.PlaceListItem[]
    count: number
}

export interface ModerationRequest {
    id: string
    hidden?: boolean
    featured?: boolean
}
