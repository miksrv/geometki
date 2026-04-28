import { ActivityType, DateTime } from '@/api/types'

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
    }
    activity?: ActivityType
    place?: Pick<Place, 'id' | 'title' | 'cover'>
    created?: DateTime
}
