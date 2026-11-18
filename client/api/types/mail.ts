import { ApiModel } from '@/api'

/**
 * What an unsubscribe link turns off: one notification type, `activity`
 * (all activity on the user's places) or `all` (server: Controllers/Mail.php).
 */
/** Email types only: achievements and levels are never emailed */
export type UnsubscribeScope = Exclude<ApiModel.NotificationType, 'achievement' | 'level'> | 'activity' | 'all'

/** `token` from the link in an email */
export interface UnsubscribeStatusRequest {
    token?: string
}

export interface UnsubscribeStatusResponse {
    token: string
    scope: UnsubscribeScope
    subscribed: boolean
}

export interface UnsubscribeRequest {
    token: string
    /** `all` turns every email off; omitted means the token's own scope */
    scope?: 'all'
}

export interface UnsubscribeResponse {
    scope: UnsubscribeScope
    subscribed: false
}

/** Whether the emails go out (`GET mail/queue`, admin only): the state of the queue for the dashboard */
export interface MailQueueResponse {
    /** When the sending job last got through the queue (UTC); null when unknown — it never ran */
    last_run_at: string | null
    /** Letters sent during the last 24 hours */
    sent_day: number
    /** Letters waiting or being sent */
    pending: number
    /** Waiting letters whose time to go came over 30 minutes ago: the job is not running (the bulk mail is left out) */
    overdue: number
    /** Letters failed during the last 7 days */
    errors_week: number
}
