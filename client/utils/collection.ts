import { buildSluggedUrl, parseSluggedId } from './slug'

// Mirrors server/app/Config/Constants.php — keep in sync.
export const COLLECTION_TITLE_MAX_LENGTH = 120

/**
 * Builds the SEO-friendly URL for a collection page: `/collections/{id}-{slug}`, or
 * `/collections/{id}` when the collection has no slug yet.
 */
export const buildCollectionUrl = (id: string, slug?: string | null): string =>
    buildSluggedUrl('/collections', id, slug)

/**
 * Extracts the canonical collection id from a route param that may be either a bare id
 * or a slugged id (`{id}-{slug}`).
 */
export const parseCollectionId = (param?: string | string[]): string => parseSluggedId(param)
