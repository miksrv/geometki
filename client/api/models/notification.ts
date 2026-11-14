import { ActivityType, DateTime } from '@/api/types'

import { Collection } from './collection'
import { Place } from './place'

export type Notification = {
    id: string
    title?: string
    message?: string
    read?: boolean
    type?: ActivityType | 'achievements'
    meta?: {
        value?: number
        title?: string
        level?: number
        image?: string
        /** An achievement: its tier, category and group — an award without a picture is drawn from them */
        tier?: string | null
        category?: string | null
        group?: string | null
        experience?: number
        levelExperience?: number
        nextLevel?: number | null
    }
    activity?: ActivityType
    place?: Pick<Place, 'id' | 'slug' | 'title' | 'cover'>
    collection?: Pick<Collection, 'id' | 'slug' | 'title'>
    created?: DateTime
}
