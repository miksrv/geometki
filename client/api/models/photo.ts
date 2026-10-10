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
    /** The place cover can be cut from it: big enough, and its licence allows changes */
    coverAllowed?: boolean
}

/** The caption of a place cover cut from a linked photo */
export type PlaceCoverCredit = Pick<PhotoExternal, 'source' | 'author' | 'license' | 'licenseUrl' | 'url'>

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
