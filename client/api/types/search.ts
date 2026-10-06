import { ApiModel } from '@/api'

export interface Request {
    q: string
    type?: 'all' | 'location' | 'coordinates' | 'places'
    category?: string
    sort?: 'relevance' | 'distance' | 'views' | 'rating' | 'created_at'
    order?: 'asc' | 'desc'
    lat?: number | null
    lon?: number | null
    limit?: number
    offset?: number
}

export interface Response {
    locations?: {
        items: ApiModel.GeoSearchLocation[]
        count: number
    }
    coordinates?: {
        lat: number
        lon: number
        secondary?: string
    }
    places?: {
        items: ApiModel.Place[]
        count: number
    }
}

export interface SuggestResponse {
    suggestions: Suggestion[]
}

export type Suggestion =
    | { type: 'place'; id: string; title: string; slug?: string | null }
    | { type: 'location'; title: string; lat: number; lon: number }
    | { type: 'coordinates'; lat: number; lon: number }
