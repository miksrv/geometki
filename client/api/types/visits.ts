import { ApiModel, ApiType } from '@/api'

/** `GET /visits`: exactly one of `place` and `user` */
export interface ListRequest {
    place?: string
    user?: string
    limit?: number
    offset?: number
}

export interface ListResponse {
    /** Newest first by the visit day */
    items: ApiModel.Visit[]
    count: number
    /** `?place=` only: how many different people, and the day of the latest visit (`YYYY-MM-DD`) */
    people?: number
    last?: string
    /** `?place=` only: up to 5 latest distinct people who checked in */
    visitors?: ApiModel.User[]
    /** `?place=` only: "How it is now", one item per answered question */
    now?: PlaceNowItem[]
}

/** The latest answer to a question, how many answers of the three years up to it agree, and the earlier years */
export interface PlaceNowItem {
    question: string
    value: string
    /** `YYYY-MM-DD` */
    visitedAt: string
    agree: number
    total: number
    /** The latest value of each earlier year (up to three) */
    history: Array<{ year: number; value: string }>
}

/** `GET /visits/places?user=`: the distinct places a person visited, latest visit first */
export interface PlacesRequest {
    user: string
    limit?: number
    offset?: number
}

export type PlacesResponse = ApiType.Places.ListResponse

/** `GET /visits/me?place=`: the signed-in visitor's own visits of a place (the button state) */
export interface MeRequest {
    place: string
}

export interface MeResponse {
    items: ApiModel.Visit[]
    count: number
    /** The questions for the place's category in a fixed order (up to three), then, last, `{ key: 'can', features }` (up to five) when the category has features; empty for a guest */
    questions: Array<{ key: string; values?: string[]; features?: string[] }>
}

/** `POST /visits`: idempotent per day — a second check-in the same day answers that day's visit */
export interface CreateRequest {
    place: string
    /** `YYYY-MM-DD`, the visitor's day; today without it */
    visitedAt?: string
}

export type CreateResponse = ApiModel.Visit & {
    /** False when the visit of that day already existed and was returned */
    isNew: boolean
    /** The number of this visit among all visits of the place, by the visit day ("Visit #24") */
    ordinal: number
    /** Nobody checked in at the place earlier in the calendar year of the visit */
    firstThisYear: boolean
}

/** `DELETE /visits/:id`: author or admin */
export interface DeleteRequest {
    id: string
    /** Sent along for the cache: the place the visit is at */
    place: string
}

/** `PATCH /visits/:id`: author only; `null` removes an answer */
export interface UpdateRequest {
    id: string
    /** Sent along for the cache: the place the visit is at */
    place: string
    answers: Record<string, string | null>
}

export type UpdateResponse = ApiModel.Visit
