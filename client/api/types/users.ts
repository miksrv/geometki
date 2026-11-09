import { ApiModel } from '@/api'
import { DateTime } from '@/api/types'

export type ItemResponse = ApiModel.User

export const UserSortFields = {
    Created: 'created_at',
    Activity: 'activity_at',
    Reputation: 'reputation',
    Experience: 'experience'
} as const

export type UserSortFields = (typeof UserSortFields)[keyof typeof UserSortFields]

export interface ListRequest {
    limit?: number
    offset?: number
    search?: string
    sort?: UserSortFields
    order?: 'ASC' | 'DESC'
    /** Adds `places` (the newest places with a cover) to every user */
    places?: 1
}

export interface ListResponse {
    items?: ApiModel.User[]
    count?: number
}

export interface CropAvatarRequest {
    x: number
    y: number
    width: number
    height: number
    filename: string
}

export interface CropAvatarResponse {
    filepath: string
}

export interface PatchRequest extends Pick<ApiModel.User, 'settings' | 'website'> {
    id?: string
    name?: string
    oldPassword?: string
    newPassword?: string
}

export interface UploadAvatarResponse {
    filename: string
    filepath: string
    width: number
    height: number
}

/** `GET /users/:id/reputation?cursor=`: the history of the reputation, a page at a time */
export interface ReputationRequest {
    id: string
}

/** One vote that moved the reputation: the person's share of it and why they got one */
export interface ReputationItem {
    /** The vote's id */
    id: string
    /** The vote, 1–5 */
    stars: number
    /** The person's share of the vote, a fraction for a share of a card made together */
    points: number
    /** `author` of the place or a `contributor` to its card (photos, edits) */
    role: 'author' | 'contributor'
    created?: DateTime
    place?: ApiModel.PlaceListItem | null
}

export interface ReputationResponse {
    reputation: number
    /** All the votes in the history */
    count: number
    items: ReputationItem[]
    /** The cursor of the next page; null after the last one */
    next: string | null
}
