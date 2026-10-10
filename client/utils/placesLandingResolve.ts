/**
 * Pure decision rules for the category/location/pair landing page
 * (`pages/places/landing/[...slug].tsx`, features/20-location-seo-pages.md). Kept separate
 * from the data fetching in `getServerSideProps` so the URL-shape decisions — which page kind
 * a pair of resolved segments is, whether to 301, whether to 404, whether to noindex — are
 * unit-testable without mocking the API or Next's request/response objects.
 */

/** The minimal shape `classifyLandingSegments` needs from a `GET /locations/resolve` result, already narrowed by the caller (`ApiType.Locations.isResolvedLocation`/`isResolvedCategory`) */
export type ResolvedSegment = { kind: 'location'; slug: string | null } | { kind: 'category'; name: string }

export type LandingClassification =
    | { kind: 'category'; categoryName: string }
    | { kind: 'location'; locationSlug: string }
    | { kind: 'pair'; locationSlug: string; categoryName: string; reversed: boolean }
    | { kind: 'not-found' }

/**
 * Decides the page kind (and, for a pair, whether the request had the location and category
 * segments reversed) from what each path segment resolved to. A location always needs a
 * slug — one without one yet (features/20-location-seo-pages.md: "slug… null until a slug
 * has been assigned") has no canonical URL to serve, so it is `not-found` here same as an
 * unresolved segment.
 */
export const classifyLandingSegments = (
    first: ResolvedSegment | null,
    second: ResolvedSegment | null
): LandingClassification => {
    if (!second) {
        if (first?.kind === 'category') {
            return { categoryName: first.name, kind: 'category' }
        }
        if (first?.kind === 'location' && first.slug) {
            return { kind: 'location', locationSlug: first.slug }
        }
        return { kind: 'not-found' }
    }

    if (first?.kind === 'location' && second.kind === 'category' && first.slug) {
        return { categoryName: second.name, kind: 'pair', locationSlug: first.slug, reversed: false }
    }

    if (first?.kind === 'category' && second.kind === 'location' && second.slug) {
        return { categoryName: first.name, kind: 'pair', locationSlug: second.slug, reversed: true }
    }

    return { kind: 'not-found' }
}

/** The canonical `/places/...` path for an already-classified landing page, or `null` for `not-found` */
export const buildLandingCanonicalPath = (classification: LandingClassification): string | null => {
    switch (classification.kind) {
        case 'category':
            return `/places/${classification.categoryName}`
        case 'location':
            return `/places/${classification.locationSlug}`
        case 'pair':
            return `/places/${classification.locationSlug}/${classification.categoryName}`
        case 'not-found':
            return null
    }
}

export interface RedirectDecisionInput {
    /**
     * Whether the request reached `pages/places/landing/[...slug].tsx` through the proxy's
     * flat-URL rewrite (`proxy.ts` sets the `x-landing-proxied` request header on the
     * rewritten request). A direct hit on the internal `/places/landing/...` path must never
     * serve content at its own URL — it is not the public, canonical path for anything and
     * would otherwise be indexable as a duplicate of `/places/{...}` (review finding,
     * 2026-10-09).
     */
    isProxied: boolean
    /** The requested segments, in request order (reversed pairs included) */
    requestedSegments: string[]
    classification: LandingClassification
}

/**
 * Returns the path to 301 to, or `null` to render normally. Fires when the request did not
 * come through the proxy rewrite, or when the requested segments do not already match the
 * canonical ones (superseded slug, reversed pair order, wrong case/history — the segments
 * reaching this function are whatever `GET /locations/resolve` matched them to).
 */
export const decideLandingRedirect = ({
    isProxied,
    requestedSegments,
    classification
}: RedirectDecisionInput): string | null => {
    const canonicalPath = buildLandingCanonicalPath(classification)

    if (!canonicalPath) {
        return null
    }

    const requestedPath = `/places/${requestedSegments.join('/')}`

    return !isProxied || requestedPath !== canonicalPath ? canonicalPath : null
}

/** 0 places → 404 for a location or pair page (features/20-location-seo-pages.md); an empty category page renders an empty state instead */
export const isLandingEmpty = (placesCount: number): boolean => placesCount <= 0

/**
 * Pagination is self-canonical (the spec's "SEO-паттерны" → "Пагинация"): a page past the end 404s
 * instead of silently rendering an empty list page 1 would never link to.
 */
export const isLandingPageOutOfRange = (currentPage: number, itemsOnPage: number): boolean =>
    currentPage > 1 && itemsOnPage === 0

/**
 * Minimum places for a landing page to be indexed and listed in the sitemap — mirrors the
 * server's `Config\LocationSlugs::$indexThreshold`, which decides `indexable` for locations
 * and pairs; a category page has no resolver flag and applies it to its own count.
 */
export const LANDING_INDEX_THRESHOLD = 5

export interface NoindexInput {
    /** lat/lon or a non-default sort/order — the existing geo-filter rule from `/places` */
    isGeoFiltered: boolean
    /** 2+ categories requested via `?category=a,b` */
    multiCategory: boolean
    /**
     * Any `?category=` on a location page (a filter the page's canonical does not carry; with
     * the pair pages on, a single one is a 301 instead) or a `?tag=`: the content differs from
     * the canonical page, so the page must not be indexed under it (SEO review, 2026-10-10)
     */
    filtered?: boolean
    /** The resolved entity's own `indexable` (placesCount >= threshold) */
    indexable: boolean
}

export const computeLandingNoindex = ({ isGeoFiltered, multiCategory, filtered, indexable }: NoindexInput): boolean =>
    isGeoFiltered || multiCategory || !!filtered || !indexable
