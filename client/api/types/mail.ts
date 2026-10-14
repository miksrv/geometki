import { ApiModel } from '@/api'

/**
 * What an unsubscribe link turns off: one notification type, `activity`
 * (all activity on the user's places) or `all` (server: Controllers/Mail.php).
 */
/** Email types only: achievements and levels are never emailed */
export type UnsubscribeScope = Exclude<ApiModel.NotificationType, 'achievement' | 'level'> | 'activity' | 'all'

/** `token` from links in emails; `mail` (an email id) from emails sent before tokens */
export interface UnsubscribeStatusRequest {
    token?: string
    mail?: string
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
