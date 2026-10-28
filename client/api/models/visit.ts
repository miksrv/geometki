import { DateTime } from '@/api/types'

import { Photo } from './photo'
import { PlaceListItem } from './place'
import { User } from './user'

/**
 * One check-in at a place ("I was here"): a log entry, a person can have many of them at
 * one place, one per day (features/25-visits-and-exploration.md, step 1)
 */
export type Visit = {
    id: string
    /** The day the person was there, `YYYY-MM-DD`: their calendar day, no time zone, shown as is */
    visitedAt: string
    /** When the visit was logged */
    created?: DateTime
    /** `GET /visits?place=`, `GET /visits/me`: who was there */
    author?: User
    /** `GET /visits?user=`: where */
    place?: PlaceListItem
    /** The photos uploaded on the day of the visit */
    photos?: Photo[]
    /** Answers to the visit questions: question key → value; a feature is `can_<feature>` → `yes` | `no` */
    answers?: Record<string, string>
}
