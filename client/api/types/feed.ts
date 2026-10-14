import { ApiModel } from '@/api'

import { DateTime } from './index'

export interface ListRequest {
    author?: string
    /** A place's history: the stories with its events, only those events shown */
    place?: string
    /** Comma-separated story types */
    types?: string
    /** Minimum story weight: 2 leaves out the compact lines (home page) */
    weight?: number
    limit?: number
    /** Only `count`, no stories (the collapsed history of the place page) */
    countOnly?: boolean
}

export interface ListResponse {
    items: ApiModel.FeedStory[]
    /** Cursor of the next page, null on the last one */
    next?: string | null
    /** Number of stories, with an `author` or `place` filter on the first page */
    count?: number
}

export interface PulseResponse {
    /** Days the counts cover: 7, or 30 when the week was quiet */
    period: number
    places: number
    photos: number
    comments: number
    ratings: number
    edits: number
    visits: number
    collections: number
    /** People who did something in the period */
    authors: number
    /** The most active of them */
    users: Array<Pick<ApiModel.User, 'id' | 'name' | 'avatar'>>
    /** The latest event on the site */
    updated?: DateTime | null
}

export interface CalendarRequest {
    author: string
}

export interface CalendarDay {
    /** YYYY-MM-DD */
    date: string
    count: number
}

export interface CalendarResponse {
    /** Days with events only */
    items: CalendarDay[]
    total: number
    /** YYYY-MM-DD, the first day of the year shown */
    from: string
    /** YYYY-MM-DD, today */
    to: string
}
