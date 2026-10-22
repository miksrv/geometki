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

/** An id: 13 lowercase hex characters (PHP `uniqid()`) */
const ID_PATTERN = /^[0-9a-f]{13}$/

/**
 * Extracts the canonical id from a route param that may be either a bare id
 * (`abc0123456789`) or a slugged id (`abc0123456789-some-title`). Anything else gives an empty
 * string, so the page is a 404 without asking the API: a mistyped URL (`/collections/aБ`) got a
 * 400 from it, which the page took for a failure and answered with a 500.
 */
export const parseSluggedId = (param?: string | string[]): string => {
    const value = Array.isArray(param) ? param[0] : param

    if (!value) {
        return ''
    }

    const dashIndex = value.indexOf('-')
    const id = dashIndex === -1 ? value : value.slice(0, dashIndex)

    return ID_PATTERN.test(id) ? id : ''
}
