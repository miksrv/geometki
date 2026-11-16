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
    /** A status, or `pending`: the letters in the queue (`created` and `process`) */
    status?: SendingMailStatus | 'pending'
    email?: string
    date_from?: string
    date_to?: string
    /** `1`: only the bulk mail (digests, mailings); `0`: only the letters that go out at once */
    bulk?: '0' | '1'
    sort?: keyof SendingMailItem
    order?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export interface SendingMailDetailResponse {
    data: SendingMailDetail
}
