/**
 * Shared helper behind the SEO-friendly `{base}/{id}-{slug}` URL scheme used by both places
 * (`/places/{id}-{slug}`) and collections (`/collections/{id}-{slug}`).
 *
 * `id` is the canonical hex identifier (never contains a dash). When a `slug` (a Latin
 * transliteration computed by the server) is available, it is appended to the id. Without a
 * slug the URL falls back to the plain `{base}/{id}`.
 */
export const buildSluggedUrl = (base: string, id: string, slug?: string | null): string =>
    slug ? `${base}/${id}-${slug}` : `${base}/${id}`

/**
 * Extracts the canonical id from a route param that may be either a bare id
 * (`abc0123456789`) or a slugged id (`abc0123456789-some-title`).
 */
export const parseSluggedId = (param?: string | string[]): string => {
    const value = Array.isArray(param) ? param[0] : param

    if (!value) {
        return ''
    }

    const dashIndex = value.indexOf('-')

    return dashIndex === -1 ? value : value.slice(0, dashIndex)
}
