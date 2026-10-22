import { UserSortFields } from '@/api/types/users'

/** The order of `/users` without `?sort=`: who was here last first */
export const USERS_DEFAULT_SORT = UserSortFields.Activity

export interface UsersFilterType {
    search?: string
    sort?: string
    order?: string
    page?: number
}
