import { DateTime } from '@/api/types'

import { PlaceListItem } from './place'

export type CollectionAuthor = {
    id: string
    name: string
    avatar?: string | null
}

export type CollectionRegion = {
    id: number
    name: string
}

/**
 * A place as returned inside a collection's `places` list: the usual place
 * list fields (including `title`, translated server-side the same way as
 * other place lists) plus the author's optional short note for that place.
 */
export type CollectionPlace = PlaceListItem & {
    note?: string | null
}

export type Collection = {
    id: string
    slug?: string | null
    title: string
    description?: string | null
    author: CollectionAuthor
    region?: CollectionRegion | null
    /** First cover of the mosaic: OG image, pickers. Derived on the server from `covers`. */
    cover?: {
        full?: string
        preview: string
    } | null
    /**
     * Covers of the first places (author's order) that have photos, up to four. Collection
     * cards draw them as a mosaic; the set follows the membership automatically.
     */
    covers?: Array<{
        full?: string
        preview: string
    }>
    placesCount: number
    views: number
    saves: number
    featured: boolean
    /** Drives the robots meta tag only — never render this in the UI. */
    indexable?: boolean
    updated: DateTime
    created: DateTime
    places?: CollectionPlace[]
}
