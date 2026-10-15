import { ApiModel } from '@/api'

export interface ListResponse {
    items?: ApiModel.Notification[]
    count?: number
    /** Cursor of the next page of `notifications/list`; null on the last page */
    next?: string | null
}

export interface ReadRequest {
    /** Notifications to mark as read; without ids all of them are marked */
    ids?: string[]
}

export interface ReadResponse {
    /** Unread notifications left (the bell badge) */
    count: number
}
