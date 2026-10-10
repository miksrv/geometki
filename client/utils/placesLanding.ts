import { ApiType } from '@/api'

import { encodeQueryData } from './url'

/**
 * Feature flags for the category/location/pair landing pages
 * (features/20-location-seo-pages.md). Each flag independently turns on the canonical URLs,
 * 301s, site links and sitemap entries for one page type, so the three types can launch weeks
 * apart ("Поэтапный запуск"). With every flag unset the site is byte-for-byte the same as
 * before this feature — every function here reduces to today's `/places?…` behaviour.
 *
 * `combinations` needs a location in the path to attach a category to, so it is forced off
 * whenever `locations` is off — callers never have to re-check the dependency themselves.
 */
export interface LandingFlags {
    categories: boolean
    locations: boolean
    combinations: boolean
}

export const getLandingFlags = (): LandingFlags => {
    const locations = process.env.NEXT_PUBLIC_LANDING_LOCATIONS === 'true'

    return {
        categories: process.env.NEXT_PUBLIC_LANDING_CATEGORIES === 'true',
        combinations: locations && process.env.NEXT_PUBLIC_LANDING_COMBINATIONS === 'true',
        locations
    }
}

export interface LandingLocationRef {
    type: ApiType.LocationTypes
    id: number
    /** From `GET /locations/resolve` — `null`/`undefined` when not yet assigned, which keeps the location out of the path even when the `locations` flag is on */
    slug?: string | null
}

/** A single category, or 2+ as a list — 2+ never goes in the path (see `buildPlacesHref`) */
export type LandingCategoryInput = string | string[] | null | undefined

const normalizeCategoryList = (category: LandingCategoryInput): string[] => {
    const list = Array.isArray(category) ? category : category ? [category] : []

    return Array.from(new Set(list.map((item) => item.trim()).filter(Boolean)))
}

export interface PlacesHrefInput {
    location?: LandingLocationRef | null
    category?: LandingCategoryInput
    tag?: string | null
    sort?: ApiType.SortFieldsType
    order?: ApiType.SortOrdersType
    page?: number | null
    lat?: number | null
    lon?: number | null
    defaultSort: ApiType.SortFieldsType
    defaultOrder: ApiType.SortOrdersType
}

export interface PlacesHref {
    /** The canonical pathname, e.g. `/places/bashkortostan/cave` — never locale-prefixed */
    pathname: string
    /** `pathname` + the query string for whatever did not fit the path */
    href: string
    /** 2+ categories were requested: the page must be `noindex, follow`, canonical to `pathname` */
    multiCategory: boolean
    /** The category segment used in the path, if any (for callers building breadcrumbs/titles) */
    categoryInPath?: string
    /** The location segment used in the path, if any */
    locationInPath?: string
}

/**
 * Builds the canonical URL for a places listing from filter state, honouring the landing
 * flags. A location is only placed in the path once it has a slug (an unassigned slug falls
 * back to the legacy numeric query params, same as the flag being off). A single category
 * joins the path unless a location is already there and `combinations` is off — then it
 * stays a query param, same as before stage 4 ships ("до этапа 4 комбинации остаются
 * query-параметром"). 2+ categories are always a query param, never part of the path.
 */
export const buildPlacesHref = (input: PlacesHrefInput, flags: LandingFlags): PlacesHref => {
    const categories = normalizeCategoryList(input.category)
    const singleCategory = categories.length === 1 ? categories[0] : undefined
    const multiCategory = categories.length >= 2

    const hasLocation = !!input.location?.id
    const useLocationPath = flags.locations && hasLocation && !!input.location?.slug
    const useCategoryPath =
        flags.categories && !!singleCategory && (!hasLocation || (useLocationPath && flags.combinations))

    const segments: string[] = []

    if (useLocationPath && input.location?.slug) {
        segments.push(input.location.slug)
    }

    if (useCategoryPath && singleCategory) {
        segments.push(singleCategory)
    }

    const pathname = segments.length ? `/places/${segments.join('/')}` : '/places'

    const query = {
        category: useCategoryPath ? undefined : categories.length ? categories.join(',') : undefined,
        country: !useLocationPath && input.location?.type === 'country' ? input.location.id : undefined,
        district: !useLocationPath && input.location?.type === 'district' ? input.location.id : undefined,
        lat: input.lat ?? undefined,
        locality: !useLocationPath && input.location?.type === 'locality' ? input.location.id : undefined,
        lon: input.lon ?? undefined,
        order: input.order !== undefined && input.order !== input.defaultOrder ? input.order : undefined,
        page: input.page && input.page !== 1 ? input.page : undefined,
        region: !useLocationPath && input.location?.type === 'region' ? input.location.id : undefined,
        sort: input.sort !== undefined && input.sort !== input.defaultSort ? input.sort : undefined,
        tag: input.tag ?? undefined
    }

    return {
        categoryInPath: useCategoryPath ? singleCategory : undefined,
        href: pathname + encodeQueryData(query),
        locationInPath: useLocationPath ? (input.location?.slug ?? undefined) : undefined,
        multiCategory,
        pathname
    }
}

// Only `location`/`category` matter for these two: `sort`/`order` are never passed, so the
// `default*` values `buildPlacesHref` needs just to know when to *drop* an explicit sort/order
// never come into play — any value works. Sentinels instead of `ApiType.SortOrders.DESC` /
// `ApiType.SortFields.Trending` on purpose: those are read from `@/api` at module-evaluation
// time, which breaks under the partial `jest.mock('@/api', …)` several component tests use
// (no `ApiType` in the mock) the moment anything imports this module transitively.
const NO_SORT_FILTER = {
    defaultOrder: '' as ApiType.SortOrdersType,
    defaultSort: '' as ApiType.SortFieldsType
}

/** A plain category link (`CategoryIcon`, category chips, breadcrumbs, …) — `/places?category=x` with the flag off, `/places/x` with it on */
export const buildCategoryHref = (categoryName: string, flags: LandingFlags): string =>
    buildPlacesHref({ category: categoryName, ...NO_SORT_FILTER }, flags).href

/** A plain location link (an address segment on a place card/hero, …) — the legacy `/places?region=…` with the flag off or no slug yet, `/places/{slug}` with it on */
export const buildLocationHref = (location: LandingLocationRef, flags: LandingFlags): string =>
    buildPlacesHref({ location, ...NO_SORT_FILTER }, flags).href

/**
 * Request header name `proxy.ts` sets (to a per-instance secret only it knows, not just the
 * literal `'1'`) on a request it rewrites to `pages/places/landing/[...slug].tsx` (via
 * `NextResponse.rewrite(url, { request: { headers } })`) — see that file for the actual
 * direct-access guard, which rejects anything under `/places/landing/...` that does not carry
 * the right value before the request ever reaches a page. `getServerSideProps` also checks
 * for the header's mere presence as a secondary, non-security-critical signal (it cannot see
 * `proxy.ts`'s secret — the two run as separate bundles/module instances, confirmed by
 * testing a shared module-level value across them) for `decideLandingRedirect` in
 * `utils/placesLandingResolve.ts`. Review finding, 2026-10-09 (twice): a request with
 * `x-landing-proxied: 1` first reached `/places/landing/...` directly because the proxy's own
 * rewrite regex excluded that path and did nothing to it at all; checking the header's value
 * against a secret, enforced in the proxy itself, closes that for good.
 */
export const LANDING_PROXY_HEADER = 'x-landing-proxied'

/** The path segment format of a place id: 13 lowercase hex characters, optionally followed by `-slug` — see `utils/place.ts` */
const PLACE_ID_SEGMENT = /^[0-9a-f]{13}(-|$)/

/** `/places/landing` is the proxy's own rewrite destination (`pages/places/landing/[...slug].tsx`) — reserved, never a valid category/location slug, same as `create`/`edit` */
const RESERVED_SEGMENTS = new Set(['create', 'edit', 'landing'])

/** True for a `/places/{segment}` path segment that is not a place id and not a reserved route — i.e. a candidate category/location slug for the landing router */
export const isLandingSegment = (segment: string): boolean =>
    !!segment && !RESERVED_SEGMENTS.has(segment) && !PLACE_ID_SEGMENT.test(segment)
