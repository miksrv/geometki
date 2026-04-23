export * as Achievements from './achievements'
export * as Activity from './activity'
export * as Auth from './auth'
export * as Bookmarks from './bookmarks'
export * as Categories from './categories'
export * as Comments from './comments'
export * as Levels from './levels'
export * as Location from './location'
export * as Notifications from './notifications'
export * as Photos from './photos'
export * as Places from './places'
export * as POI from './poi'
export * as Rating from './rating'
export * as SendingMail from './sending-mail'
export * as SiteMap from './siteMap'
export * as Tags from './tags'
export * as Users from './users'
export * as Visited from './visited'

export interface DateTime {
    date: string
    timezone_type: number
    timezone: string
}

export type Coordinates = {
    lat: number
    lon: number
}

export type ActivityType =
    | 'photo'
    | 'place'
    | 'rating'
    | 'edit'
    | 'cover'
    | 'experience'
    | 'level'
    | 'achievements'
    | 'success'
    | 'warning'
    | 'error'

export type Locale = 'en' | 'ru'

export type UserRole = 'user' | 'moderator' | 'admin'

export type AuthService = 'google' | 'yandex' | 'vk' | 'native'

export type LocationTypes = 'country' | 'region' | 'district' | 'locality'

export const SortOrders = {
    ASC: 'ASC',
    DESC: 'DESC'
} as const

export type SortOrdersType = (typeof SortOrders)[keyof typeof SortOrders]

export const SortFields = {
    Bookmarks: 'bookmarks',
    Category: 'category',
    Comments: 'comments',
    Created: 'created_at',
    Distance: 'distance',
    Rating: 'rating',
    Updated: 'updated_at',
    Views: 'views',
    ViewsWeek: 'views_week',
    Trending: 'trending',
    Recommended: 'recommended'
} as const

export type SortFieldsType = (typeof SortFields)[keyof typeof SortFields]
