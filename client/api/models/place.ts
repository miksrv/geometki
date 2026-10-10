import { DateTime } from '@/api/types'

import { Address } from './address'
import { Categories } from './category'
import { User } from './user'

export type Place = {
    id: string
    slug?: string | null
    created?: DateTime
    updated?: DateTime
    lat: number
    lon: number
    rating?: number
    views?: number
    photos?: number
    comments?: number
    bookmarks?: number
    title: string
    content?: string
    difference?: number
    distance?: number
    author?: User
    editors?: User[]
    /** The category key; its label and texts come from `utils/categories.ts` */
    category?: Categories
    address?: Address
    tags?: string[]
    cover?: {
        full?: string
        preview: string
    }
    visitRadiusM?: number
    verificationExempt?: boolean
}

/**
 * A place as returned in lists (places list, search, collection places, recommendations,
 * visited): the card data only. Who added the place does not belong on a card, so lists
 * never carry `author`/`editors`; the place page fetches the full `Place`.
 * `updated` stays only as the cover version source (see DESIGN.md).
 */
export type PlaceListItem = Omit<Place, 'author' | 'editors'>
