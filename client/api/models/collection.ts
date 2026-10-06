import { DateTime } from '@/api/types'

import { Category } from './category'
import { Place } from './place'

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
export type CollectionPlace = Place & {
    note?: string | null
}

export type Collection = {
    id: string
    slug?: string | null
    title: string
    description?: string | null
    metaDescription?: string | null
    author: CollectionAuthor
    region?: CollectionRegion | null
    category?: Category | null
    cover?: {
        full?: string
        preview: string
    }
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
