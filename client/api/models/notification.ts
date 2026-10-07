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
        experience?: number
        nextLevel?: number
    }
    activity?: ActivityType
    place?: Pick<Place, 'id' | 'slug' | 'title' | 'cover'>
    collection?: Pick<Collection, 'id' | 'slug' | 'title'>
    created?: DateTime
}
