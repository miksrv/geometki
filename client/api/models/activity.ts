import { DateTime } from '@/api/types'

import { Comment } from './comment'
import { Photo } from './photo'
import { Place } from './place'
import { Rating } from './rating'
import { User } from './user'

export type Activity = {
    type: ActivityEnum
    views?: number
    place?: Place
    photos?: Photo[]
    rating?: Rating
    author?: User
    comment?: Comment
    created?: DateTime
}

export const ActivityTypes = {
    Comment: 'comment',
    Cover: 'cover',
    Edit: 'edit',
    Photo: 'photo',
    Place: 'place',
    Rating: 'rating',
    Visit: 'visit'
} as const

export type ActivityEnum = (typeof ActivityTypes)[keyof typeof ActivityTypes]
