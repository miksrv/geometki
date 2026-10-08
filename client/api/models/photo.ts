import { DateTime } from '@/api/types'

import { User } from './user'

/** Services whose photos can be linked to a place */
export type PhotoExternalSource = 'wikimedia' | 'pastvu'

/** A Wikimedia Commons or PastVu photo linked to a place: the image stays on the source server */
export type PhotoExternal = {
    source: PhotoExternalSource
    externalId: string
    /** Title of the photo in the source */
    title?: string | null
    author?: string | null
    license?: string | null
    licenseUrl?: string | null
    year?: number | null
    /** Page of the photo in the source */
    url: string
}

export type Photo = {
    id: string
    full: string
    preview: string
    width: number
    height: number
    title?: string
    author?: User
    created?: DateTime
    filesize?: number
    placeId?: string
    /** Set for the linked photos: they can be removed from the place, but not rotated */
    external?: PhotoExternal
}
