export type UserStatistic = {
    place: number
    photo: number
    rating: number
    edit: number
    comment: number
    /** Distinct places the person checked in at */
    visited: number
    /** All their check-ins (a place can have several) */
    visits: number
    /** `GET /users/:id` only: the places in their bookmarks that still exist */
    bookmarks?: number
}
