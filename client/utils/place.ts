/**
 * Builds the SEO-friendly URL for a place page.
 *
 * `id` is the canonical 13-character lowercase hex identifier (it never contains a dash).
 * When a `slug` (a Latin transliteration of the place title, computed by the server) is
 * available, it is appended to the id to produce `/places/{id}-{slug}`. Without a slug the
 * URL falls back to the plain `/places/{id}`.
 */
export const buildPlaceUrl = (id: string, slug?: string | null): string =>
    slug ? `/places/${id}-${slug}` : `/places/${id}`

/**
 * Extracts the canonical place id from a route param that may be either a bare id
 * (`abc0123456789`) or a slugged id (`abc0123456789-some-place-title`).
 */
export const parsePlaceId = (param?: string | string[]): string => {
    const value = Array.isArray(param) ? param[0] : param

    if (!value) {
        return ''
    }

    const dashIndex = value.indexOf('-')

    return dashIndex === -1 ? value : value.slice(0, dashIndex)
}
