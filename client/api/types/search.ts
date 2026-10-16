import { ApiModel } from '@/api'

export interface Request {
    q: string
    type?: 'all' | 'location' | 'coordinates' | 'places'
    /** Categories, comma-separated */
    category?: string
    /** Each sort has its natural direction (distance — nearest first, the rest — most first) */
    sort?: SortType
    order?: 'asc' | 'desc'
    lat?: number | null
    lon?: number | null
    limit?: number
    offset?: number
}

export type SortType = 'relevance' | 'distance' | 'views' | 'rating' | 'comments' | 'created_at'

export interface Response {
    locations?: {
        items: ApiModel.GeoSearchLocation[]
        count: number
    }
    coordinates?: {
        lat: number
        lon: number
        secondary?: string
        /** The query itself is a point; otherwise this is the point of the top result */
        parsed?: boolean
    }
    places?: {
        items: ApiModel.PlaceListItem[]
        /** Places with the category filter */
        count: number
        /** Found places per category before the category filter: the facets */
        categories?: Partial<Record<ApiModel.Categories, number>>
    }
}

export interface SuggestResponse {
    suggestions: Suggestion[]
}

export type Suggestion =
    | { type: 'place'; id: string; title: string; slug?: string | null; category?: ApiModel.Categories | null }
    | { type: 'location'; title: string; lat: number; lon: number }
    | { type: 'coordinates'; lat: number; lon: number }
