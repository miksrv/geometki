import { ApiType } from '@/api'

/**
 * The landing-page API behind `/places/{location}`-style URLs
 * (features/20-location-seo-pages.md). Distinct from `ApiType.Location` (singular), which
 * serves the existing filter UI (`location/search`, `location/geosearch`, …).
 */

export interface ResolveRequest {
    slug?: string
    type?: ApiType.LocationTypes
    legacyId?: number
}

export interface LocationParentRef {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    title: string
}

export interface ResolvedLocation {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    title: string
    parents: LocationParentRef[]
    placesCount: number
    indexable: boolean
}

export interface ResolvedCategory {
    type: 'category'
    name: string
    title: string
}

export interface ResolvedRedirect {
    redirect: string
}

export type ResolveResponse = ResolvedLocation | ResolvedCategory | ResolvedRedirect

export const isResolvedLocation = (data?: ResolveResponse | null): data is ResolvedLocation => !!data && 'id' in data

export const isResolvedCategory = (data?: ResolveResponse | null): data is ResolvedCategory =>
    !!data && 'type' in data && data.type === 'category'

export const isResolvedRedirect = (data?: ResolveResponse | null): data is ResolvedRedirect =>
    !!data && 'redirect' in data

export interface LocationTypeIdRequest {
    type: ApiType.LocationTypes
    id: number
}

export interface LocationCategoryItem {
    name: string
    title: string
    count: number
    indexable: boolean
}

export interface CategoriesResponse {
    items: LocationCategoryItem[]
}

export interface LocationChildItem {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    title: string
    placesCount: number
    indexable: boolean
}

export interface ChildrenResponse {
    items: LocationChildItem[]
}

export interface SummaryCategoryItem {
    name: string
    title: string
    count: number
}

export interface SummaryResponse {
    placesCount: number
    indexable: boolean
    categories: SummaryCategoryItem[]
    lastAddedAt: string | null
}

export interface CategoryLocationsRequest {
    name: string
    level?: 'region' | 'locality'
    limit?: number
}

export interface CategoryLocationItem {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    title: string
    placesCount: number
    indexable: boolean
}

export interface CategoryLocationsResponse {
    items: CategoryLocationItem[]
}
