import { User } from '@/api/models'
import { DateTime } from '@/api/types'

/**
 * created → process → completed | grouped (sent inside the email of `groupId`) | error |
 * rejected (nothing to send, or the recipient turned it off) | expired (not sent in time)
 */
export type SendingMailStatus = 'created' | 'process' | 'completed' | 'grouped' | 'error' | 'rejected' | 'expired'

export interface SendingMailActivity {
    type: string
}

export interface SendingMailItem {
    id: string
    status: SendingMailStatus
    email: string | null
    subject: string | null
    error: string | null
    /** Notification type: comment, photo, …, digest */
    type: string | null
    attempts: number
    groupId: string | null
    created?: DateTime
    updated?: DateTime
    sent?: DateTime | null
    user: Pick<User, 'id' | 'name' | 'avatar'>
    activity: SendingMailActivity | null
}

export interface SendingMailDetail extends SendingMailItem {
    message: string | null
}

export interface SendingMailStats {
    total: number
    completed: number
    error: number
    pending: number
}

export interface SendingMailListResponse {
    items: SendingMailItem[]
    count: number
    limit: number
    offset: number
    stats: SendingMailStats
}

export interface SendingMailListRequest {
    status?: SendingMailStatus
    email?: string
    date_from?: string
    date_to?: string
    sort?: keyof SendingMailItem
    order?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export interface SendingMailDetailResponse {
    data: SendingMailDetail
}
