import { ApiModel } from '@/api'

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
