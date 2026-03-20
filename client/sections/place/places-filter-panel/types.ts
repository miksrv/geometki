import { ApiType } from '@/api'

export type PlacesFilterType = {
    country?: number
    region?: number
    district?: number
    locality?: number
    category?: string
    page?: number
    tag?: string
    lat?: number
    lon?: number
    order?: ApiType.SortOrdersType
    sort?: ApiType.SortFieldsType
}
