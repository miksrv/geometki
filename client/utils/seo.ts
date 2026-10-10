import { SITE_LINK } from '@/config/env'

/**
 * Builds hreflang alternate link tags for the ru/en locale pair.
 * @param path - The page path without a leading slash (e.g. 'places/123'). Pass '' for the homepage.
 * @param query - The canonical query string, `?` included (e.g. '?page=2'), so that a paginated
 *   page's alternates point at the same page in the other locale, not at page 1 — hreflang
 *   must name the canonical URL of each locale version.
 */
export const buildHreflangTags = (path: string, query = '') => {
    const base = SITE_LINK?.endsWith('/') ? SITE_LINK : `${SITE_LINK}/`
    const ruUrl = (path ? `${base}${path}` : base) + query
    const enUrl = (path ? `${base}en/${path}` : `${base}en`) + query

    return [
        { keyOverride: 'hreflang-ru', rel: 'alternate', hrefLang: 'ru', href: ruUrl },
        { keyOverride: 'hreflang-en', rel: 'alternate', hrefLang: 'en', href: enUrl },
        { keyOverride: 'hreflang-x-default', rel: 'alternate', hrefLang: 'x-default', href: ruUrl }
    ]
}
