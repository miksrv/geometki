import { ApiModel, ApiType } from '@/api'

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
        /** All found places with the category filter */
        count: number
        /** How many of them the pages reach: only the most relevant ones are sorted and paged */
        available?: number
        /** Found places per category before the category filter: the facets */
        categories?: Partial<Record<ApiModel.Categories, number>>
    }
}

export interface SuggestResponse {
    suggestions: Suggestion[]
}

/**
 * `GET /search/suggest`, in this order: the point the query parses as, places (with the
 * locality and region), the site's locations with places (`area`: their places listing),
 * and only without them geocoder addresses (`location`: a point on the map)
 */
export type Suggestion =
    | {
          type: 'place'
          id: string
          title: string
          slug?: string | null
          category?: ApiModel.Categories | null
          /** "Locality, Region" */
          address?: string | null
      }
    | {
          type: 'area'
          locationType: ApiType.LocationTypes
          id: number
          slug?: string | null
          title: string
          /** The region of a district or a locality */
          region?: string | null
          placesCount: number
      }
    | { type: 'location'; title: string; secondary?: string | null; lat: number; lon: number }
    | { type: 'coordinates'; lat: number; lon: number }
