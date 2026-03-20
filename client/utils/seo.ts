import { SITE_LINK } from '@/config/env'

/**
 * Builds hreflang alternate link tags for the ru/en locale pair.
 * @param path - The page path without a leading slash (e.g. 'places/123'). Pass '' for the homepage.
 */
export const buildHreflangTags = (path: string) => {
    const base = SITE_LINK?.endsWith('/') ? SITE_LINK : `${SITE_LINK}/`
    const ruUrl = path ? `${base}${path}` : base
    const enUrl = path ? `${base}en/${path}` : `${base}en`

    return [
        { rel: 'alternate', hrefLang: 'ru', href: ruUrl },
        { rel: 'alternate', hrefLang: 'en', href: enUrl },
        { rel: 'alternate', hrefLang: 'x-default', href: ruUrl }
    ]
}
