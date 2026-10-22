import { AuthService, DateTime, Locale, UserRole } from '@/api/types'

import { Categories } from './category'
import { UserLevel } from './userLevel'
import { UserSettings } from './userSettings'
import { UserStatistic } from './userStatistic'

export type User = {
    id: string
    name: string
    email?: string
    avatar?: string
    reputation?: number
    website?: string
    role?: UserRole
    locale?: Locale
    levelData?: UserLevel
    created?: DateTime
    updated?: DateTime
    activity?: DateTime
    authType?: AuthService
    statistic?: UserStatistic
    settings?: UserSettings
    /** `GET /users?places=1` only: the user's newest places with a cover, at most four */
    places?: UserPlacePreview[]
}

/** A place on a user's card in the people list: its cover, category and title */
export type UserPlacePreview = {
    id: string
    slug?: string
    category?: Categories
    title?: string
    cover: { preview: string }
}
