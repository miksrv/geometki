import { ApiType } from '@/api'

export type AddressItem = {
    id: number
    name: string
    type?: ApiType.LocationTypes
    /** The landing-page path segment for this location (features/20-location-seo-pages.md) — `null`/absent until a slug has been assigned */
    slug?: string | null
}

export type Address = {
    street?: string
    country?: AddressItem
    region?: AddressItem
    district?: AddressItem
    locality?: AddressItem
}
