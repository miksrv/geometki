import { ApiModel, ApiType } from '@/api'

// `updated` is the same wrapped PHP `DateTime` shape `places`/`users`/`collections` use below
// (`App\Controllers\Sitemap` serializes every entry the same way) — unwrap with `.date`, same
// as `placesPages`/`usersPages`/`collectionsPages` in `pages/sitemap.tsx`.
export interface SiteMapCategory {
    name: string
    updated: ApiType.DateTime
}

export interface SiteMapLocation {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    updated: ApiType.DateTime
}

export interface SiteMapLocationCategory {
    type: ApiType.LocationTypes
    id: number
    slug: string | null
    category: string
    updated: ApiType.DateTime
}

export interface Response {
    places?: ApiModel.SiteMap[]
    users?: ApiModel.SiteMap[]
    collections?: ApiModel.SiteMap[]
    /** Indexable (placesCount >= threshold) landing pages — features/20-location-seo-pages.md */
    categories?: SiteMapCategory[]
    locations?: SiteMapLocation[]
    locationCategories?: SiteMapLocationCategory[]
}
