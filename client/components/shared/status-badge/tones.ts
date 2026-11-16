import { ApiType } from '@/api'

import type { StatusTone } from './StatusBadge'

/** A season of the admin list: where it stands (`seasonStatus`) */
export const SEASON_STATUS_TONES: Record<'closed' | 'current' | 'ending' | 'upcoming', StatusTone> = {
    closed: 'neutral',
    current: 'success',
    ending: 'warning',
    upcoming: 'info'
}

/** A mail of the sending log */
export const MAIL_STATUS_TONES: Record<ApiType.SendingMail.SendingMailStatus, StatusTone> = {
    completed: 'success',
    created: 'neutral',
    error: 'danger',
    expired: 'neutral',
    grouped: 'success',
    process: 'info',
    rejected: 'neutral'
}

/** An achievement's type */
export const ACHIEVEMENT_TYPE_TONES: Record<ApiType.Achievements.AchievementType, StatusTone> = {
    base: 'neutral',
    seasonal: 'info'
}

/** A mailing of the admin list */
export const MAILING_STATUS_TONES: Record<ApiType.Mailings.MailingStatus, StatusTone> = {
    canceled: 'neutral',
    completed: 'success',
    draft: 'warning',
    sending: 'info'
}
