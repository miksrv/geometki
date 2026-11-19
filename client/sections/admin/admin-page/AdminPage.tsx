import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { AdminFact, AdminPageShell, AdminWidget } from '@/components/shared'
import { isMailJobLate, useAdminAttention } from '@/hooks/useAdminAttention'
import { ADMIN_ACHIEVEMENTS_HREF, ADMIN_MAILINGS_HREF, adminListHref } from '@/utils/admin'
import { localPlainDate, timeAgo } from '@/utils/date'
import { formatThousands } from '@/utils/helpers'

import { AdminAttention } from './AdminAttention'

import styles from './styles.module.sass'

type Achievement = ApiType.Achievements.AchievementAdmin

/** Only the counters of the list are read: one row is enough */
const MAILING_STATS_QUERY = { limit: 1, page: 1 } as const

/** A limited award is running today when it is on and today is within its window */
export const isRunningNow = (achievement: Achievement, today: string): boolean =>
    achievement.is_active &&
    achievement.type === 'seasonal' &&
    !!achievement.season_start &&
    !!achievement.season_end &&
    achievement.season_start.slice(0, 10) <= today &&
    today <= achievement.season_end.slice(0, 10)

/**
 * The overview of the administrator (`/admin`, ADMIN-UI.md → The dashboard): first what needs
 * attention, then a card per section with the few facts of its state, each a link into the
 * list filtered by it, and the section's create action. Nothing here repeats a public page or
 * a list of the admin; a card loads and fails on its own, never the page.
 */
export const AdminPage: React.FC = () => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const attention = useAdminAttention()
    const achievements = API.useGetAchievementsManageQuery(undefined, { skip: !isAuth })
    const mail = API.useMailGetQueueQuery(undefined, { skip: !isAuth })
    const mailings = API.useMailingsGetListQuery(MAILING_STATS_QUERY, { skip: !isAuth })

    const error = t('admin-widget-error')
    const number = (value: number | undefined) => formatThousands(value ?? 0)

    const achievementFacts = (list: Achievement[] = []): AdminFact[] => {
        const today = localPlainDate(0)

        return [
            {
                href: adminListHref(ADMIN_ACHIEVEMENTS_HREF, { state: 'on' }),
                key: 'on',
                label: t('admin-widget-achievements-active'),
                value: number(list.filter((achievement) => achievement.is_active).length)
            },
            {
                href: adminListHref(ADMIN_ACHIEVEMENTS_HREF, { state: 'off' }),
                key: 'off',
                label: t('admin-widget-achievements-off'),
                value: number(list.filter((achievement) => !achievement.is_active).length)
            },
            {
                href: adminListHref(ADMIN_ACHIEVEMENTS_HREF, { state: 'on', type: 'seasonal' }),
                key: 'limited',
                label: t('admin-widget-achievements-limited'),
                value: number(list.filter((achievement) => isRunningNow(achievement, today)).length)
            }
        ]
    }

    const mailingFacts = (): AdminFact[] => {
        const stats = mailings.data?.stats

        return [
            {
                href: adminListHref(ADMIN_MAILINGS_HREF, { status: 'draft' }),
                key: 'draft',
                label: t('admin-mailing-status-draft'),
                value: number(stats?.draft)
            },
            {
                href: adminListHref(ADMIN_MAILINGS_HREF, { status: 'sending' }),
                key: 'sending',
                label: t('admin-mailing-status-sending'),
                value: number(stats?.sending)
            },
            {
                href: adminListHref(ADMIN_MAILINGS_HREF, { status: 'completed' }),
                key: 'completed',
                label: t('admin-mailing-status-completed'),
                value: number(stats?.completed)
            }
        ]
    }

    /** Whether the emails go out: the sending job's last run and the queue; there is no list behind */
    const mailFacts = (): AdminFact[] => {
        const queue = mail.data

        return [
            {
                key: 'job',
                label: t('admin-widget-mail-job'),
                tone: isMailJobLate(queue) ? 'danger' : undefined,
                value: queue?.last_run_at ? timeAgo(queue.last_run_at) : t('admin-widget-mail-job-unknown')
            },
            {
                key: 'sent',
                label: t('admin-widget-mail-sent-day'),
                value: number(queue?.sent_day)
            },
            {
                key: 'queue',
                label: t('admin-widget-mail-queue'),
                tone: queue?.overdue ? 'danger' : undefined,
                value: number(queue?.pending)
            },
            {
                key: 'errors',
                label: t('admin-overview-mail-errors-week'),
                tone: queue?.errors_week ? 'danger' : undefined,
                value: number(queue?.errors_week)
            }
        ]
    }

    const createButton = (href: string, label: string) => (
        <Button
            mode={'secondary'}
            size={'small'}
            link={href}
            label={label}
        />
    )

    return (
        <AdminPageShell title={t('admin-overview')}>
            <AdminAttention
                items={attention.items}
                loading={attention.loading}
                error={attention.error}
            />

            <div className={styles.grid}>
                <AdminWidget
                    icon={'Award'}
                    title={t('achievements-admin-title')}
                    href={ADMIN_ACHIEVEMENTS_HREF}
                    facts={achievementFacts(achievements.data?.data)}
                    loading={achievements.isLoading}
                    error={achievements.isError ? error : undefined}
                    footer={createButton(`${ADMIN_ACHIEVEMENTS_HREF}/create`, t('achievements-admin-add'))}
                />
                <AdminWidget
                    icon={'Comment'}
                    title={t('admin-mailings-title')}
                    href={ADMIN_MAILINGS_HREF}
                    facts={mailingFacts()}
                    loading={mailings.isLoading}
                    error={mailings.isError ? error : undefined}
                    footer={createButton(`${ADMIN_MAILINGS_HREF}/create`, t('admin-mailing-create'))}
                />
                <AdminWidget
                    icon={'Feed'}
                    title={t('admin-mail-title')}
                    facts={mailFacts()}
                    loading={mail.isLoading}
                    error={mail.isError ? error : undefined}
                />
            </div>
        </AdminPageShell>
    )
}
