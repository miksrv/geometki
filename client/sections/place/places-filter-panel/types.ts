import { ApiModel, ApiType } from '@/api'

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
    notVisited?: 1
}

/** What the listing shows, as the filter panel sees it; the page turns it into a URL */
export interface PlacesFilterState {
    /** The chosen location (with its `type`); none — everywhere */
    location?: ApiModel.AddressItem
    categories: string[]
    sort: ApiType.SortFieldsType
    /** "Скрыть посещённые" — signed-in visitors only */
    notVisited: boolean
    tag?: string
}

/** A change of the filters: only the given keys change, `location: null` / `tag: null` clear them */
export type PlacesFilterPatch = Partial<Omit<PlacesFilterState, 'location' | 'tag'>> & {
    location?: ApiModel.AddressItem | null
    tag?: string | null
}
