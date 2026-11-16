import { useMemo } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { ADMIN_MAIL_HREF, ADMIN_SEASONS_HREF, adminListHref, AdminPeriod, AdminSectionKey } from '@/utils/admin'
import { formatPlainDate, localPlainDate } from '@/utils/date'
import { seasonWithoutNext } from '@/utils/game'

export interface AdminAttentionItem {
    key: string
    section: AdminSectionKey
    /** `danger` — it is broken now, `warning` — it will break unless something is done, `info` — unfinished */
    tone: 'danger' | 'warning' | 'info'
    message: string
    /** Where it is fixed, and the words of the link that leads there */
    href: string
    action: string
    /** How many things are wrong (letters with an error); none for a single fact */
    count?: number
}

/** The window of "recent" mail errors: an old error nobody can act on is not a reason to worry */
export const MAIL_ERRORS_PERIOD: AdminPeriod = '7d'

/** Letters that failed during the last week: only their `count` is read */
export const mailErrorsQuery = (): ApiType.SendingMail.SendingMailListRequest => ({
    date_from: localPlainDate(-7),
    limit: 1,
    page: 1,
    status: 'error'
})

/** Letters still in the queue since yesterday or earlier: the sending job is not running. The bulk
    mail is left out: over the hosting limits it waits for the next days on purpose */
export const mailStuckQuery = (): ApiType.SendingMail.SendingMailListRequest => ({
    bulk: '0',
    date_to: localPlainDate(-1),
    limit: 1,
    page: 1,
    status: 'pending'
})

const SEASONS_CREATE_HREF = `${ADMIN_SEASONS_HREF}/create`

/**
 * What an administrator has to do something about, across the sections of the admin: the one
 * list behind the dashboard's "Требует внимания" and the marks of the navigation. A rule is a
 * fact with a way to fix it; a number that is merely interesting does not belong here.
 */
export const useAdminAttention = (): { error: boolean; items: AdminAttentionItem[]; loading: boolean } => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const seasons = API.useGameGetSeasonsManageQuery(undefined, { skip: !isAuth })
    const mailErrors = API.useGetSendingMailListQuery(mailErrorsQuery(), { skip: !isAuth })
    const mailStuck = API.useGetSendingMailListQuery(mailStuckQuery(), { skip: !isAuth })

    const items = useMemo(() => {
        const result: AdminAttentionItem[] = []
        const list = seasons.data?.items

        if (list) {
            const open = list.filter((season) => !season.closed)
            const running = open.some((season) => season.current)
            const withoutNext = seasonWithoutNext(list)

            if (!running && !open.some((season) => season.upcoming)) {
                result.push({
                    action: t('admin-seasons-add'),
                    href: SEASONS_CREATE_HREF,
                    key: 'seasons-none',
                    message: t('admin-attention-seasons-none'),
                    section: 'seasons',
                    tone: 'danger'
                })
            } else if (withoutNext) {
                result.push({
                    action: t('admin-seasons-add'),
                    href: SEASONS_CREATE_HREF,
                    key: 'seasons-next',
                    message: t('admin-seasons-next-missing', {
                        date: formatPlainDate(withoutNext.ends_on, 'D MMMM')
                    }),
                    section: 'seasons',
                    tone: 'warning'
                })
            }

            open.filter((season) => (season.current || season.upcoming) && !season.image).forEach((season) => {
                result.push({
                    action: t('admin-attention-season-image-action'),
                    href: `${ADMIN_SEASONS_HREF}/${season.id}`,
                    key: `season-image-${season.id}`,
                    message: t('admin-attention-season-image', { title: season.title_ru }),
                    section: 'seasons',
                    tone: 'info'
                })
            })
        }

        const stuck = mailStuck.data?.count ?? 0
        const errors = mailErrors.data?.count ?? 0

        if (stuck > 0) {
            result.push({
                action: t('admin-attention-open'),
                count: stuck,
                href: adminListHref(ADMIN_MAIL_HREF, { status: 'pending' }),
                key: 'mail-stuck',
                message: t('admin-attention-mail-stuck', { count: stuck }),
                section: 'mail',
                tone: 'danger'
            })
        }

        if (errors > 0) {
            result.push({
                action: t('admin-attention-open'),
                count: errors,
                href: adminListHref(ADMIN_MAIL_HREF, { period: MAIL_ERRORS_PERIOD, status: 'error' }),
                key: 'mail-errors',
                message: t('admin-attention-mail-errors', { count: errors }),
                section: 'mail',
                tone: 'warning'
            })
        }

        const rank = { danger: 0, info: 2, warning: 1 }

        return result.sort((a, b) => rank[a.tone] - rank[b.tone])
    }, [seasons.data, mailErrors.data, mailStuck.data, t])

    return {
        // A failed source is not "all is well": the dashboard says it could not load instead of the calm line
        error: seasons.isError || mailErrors.isError || mailStuck.isError,
        items,
        loading: seasons.isLoading || mailErrors.isLoading || mailStuck.isLoading
    }
}
