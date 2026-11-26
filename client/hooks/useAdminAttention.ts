import { useMemo } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { AdminSectionKey } from '@/utils/admin'
import { minutesAgo, timeAgo } from '@/utils/date'

export interface AdminAttentionItem {
    key: string
    section: AdminSectionKey
    /** `danger` — it is broken now, `warning` — it will break unless something is done, `info` — unfinished */
    tone: 'danger' | 'warning' | 'info'
    message: string
    /** Where it is fixed, and the words of the link that leads there; none when it is fixed outside the site */
    href?: string
    action?: string
    /** How many things are wrong (letters with an error); none for a single fact */
    count?: number
}

/** A last run of the sending job longer ago than this means it stopped, unless the server says longer (`late_after`) */
export const MAIL_JOB_LATE_MINUTES = 15

/** The job has not got through the queue for too long, or never did (or its mark was lost) */
export const isMailJobLate = (queue?: ApiType.Mail.MailQueueResponse): boolean =>
    !!queue &&
    (!queue.last_run_at || minutesAgo(queue.last_run_at) > Math.max(MAIL_JOB_LATE_MINUTES, queue.late_after ?? 0))

/**
 * What an administrator has to do something about, across the sections of the admin: the one
 * list behind the dashboard's "Требует внимания" and the marks of the navigation. A rule is a
 * fact with a way to fix it; a number that is merely interesting does not belong here.
 */
export const useAdminAttention = (): { error: boolean; items: AdminAttentionItem[]; loading: boolean } => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const mail = API.useMailGetQueueQuery(undefined, { skip: !isAuth })

    const items = useMemo(() => {
        const result: AdminAttentionItem[] = []

        const queue = mail.data

        if (queue && isMailJobLate(queue)) {
            result.push({
                key: 'mail-job',
                message: queue.last_run_at
                    ? t('admin-attention-mail-job-late', { time: timeAgo(queue.last_run_at) })
                    : t('admin-attention-mail-job-unknown'),
                section: 'mail',
                tone: 'danger'
            })
        }

        if (queue?.overdue) {
            result.push({
                count: queue.overdue,
                key: 'mail-overdue',
                message: t('admin-attention-mail-overdue', { count: queue.overdue }),
                section: 'mail',
                tone: 'danger'
            })
        }

        if (queue?.errors_week) {
            result.push({
                count: queue.errors_week,
                key: 'mail-errors',
                message: t('admin-attention-mail-errors', { count: queue.errors_week }),
                section: 'mail',
                tone: 'warning'
            })
        }

        const rank = { danger: 0, info: 2, warning: 1 }

        return result.sort((a, b) => rank[a.tone] - rank[b.tone])
    }, [mail.data, t])

    return {
        // A failed source is not "all is well": the dashboard says it could not load instead of the calm line
        error: mail.isError,
        items,
        loading: mail.isLoading
    }
}
