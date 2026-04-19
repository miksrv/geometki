import { ActivityType, DateTime } from '@/api/types'

import { Place } from './place'
import { UserLevel } from './userLevel'

export type Notification = {
    id: string
    title?: string
    message?: string
    read?: boolean
    type?: ActivityType | 'achievements'
    meta?: UserLevel & {
        value?: number
        achievement_id?: string
        group_slug?: string
        tier?: string
        title_en?: string
        title_ru?: string
        icon?: string
        image?: string
        xp_bonus?: number
        is_upgrade?: boolean
    }
    activity?: ActivityType
    place?: Pick<Place, 'id' | 'title' | 'cover'>
    created?: DateTime
}
