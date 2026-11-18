import { ApiType } from '@/api'

import type { StatusTone } from './StatusBadge'

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
