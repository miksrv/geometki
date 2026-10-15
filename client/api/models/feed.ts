import { DateTime } from '@/api/types'
import { AchievementTier } from '@/api/types/achievements'

import { Collection } from './collection'
import { Photo } from './photo'
import { PlaceListItem } from './place'
import { User } from './user'

/** Kinds of feed stories (`feed.type` on the server) */
export const FeedStoryTypes = {
    Achievement: 'achievement',
    Collection: 'collection',
    CollectionPlace: 'collection_place',
    Comment: 'comment',
    Edit: 'edit',
    Level: 'level',
    Photo: 'photo',
    /** PastVu / Wikimedia Commons photos linked to a place: shown from the source servers */
    PhotoLink: 'photo_link',
    Place: 'place',
    Rating: 'rating',
    Visit: 'visit'
} as const

export type FeedStoryType = (typeof FeedStoryTypes)[keyof typeof FeedStoryTypes]

/** A place of a multi-place story; `value` is the author's score in a rating story */
export type FeedPlace = PlaceListItem & {
    value?: number
}

export type FeedCollection = Pick<Collection, 'id' | 'slug' | 'title' | 'covers' | 'placesCount'>

export type FeedAchievement = {
    id: string
    title: string
    image?: string | null
    tier: AchievementTier
}

/**
 * One card of the activity feed: a group of events of one author (a new place with its
 * photos, a batch of ratings, a review), or an achievement / a new level. Which optional
 * fields are set depends on `type` (see server/app/Libraries/FeedPresenter.php).
 */
export type FeedStory = {
    id: string
    type: FeedStoryType
    /** 3 — a card with a picture, 2 — a card, 1 — a compact line */
    weight: 1 | 2 | 3
    /** The first event */
    created: DateTime
    /** The last event: the feed is ordered by it */
    updated: DateTime
    /** Events in the story */
    count: number
    /** Absent for guests */
    author?: Pick<User, 'id' | 'name' | 'avatar'>
    /** place, photo, photo_link, edit, comment; `content` is the start of its description (markdown) */
    place?: PlaceListItem
    /** place, photo, photo_link; linked photos carry their source in `external` */
    photos?: Photo[]
    photosCount?: number
    /** edit */
    changes?: Array<'description' | 'cover'>
    /** comment */
    comment?: {
        id: string
        content: string
    }
    /** rating, visit, collection_place */
    places?: FeedPlace[]
    placesCount?: number
    /** collection, collection_place */
    collection?: FeedCollection
    /** achievement */
    achievement?: FeedAchievement
    /** level: the level reached */
    level?: number
}
