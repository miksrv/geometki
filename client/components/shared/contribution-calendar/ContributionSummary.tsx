import React, { useMemo } from 'react'
import dayjs from 'dayjs'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { calendarSummary } from '@/utils/feed'

import styles from './styles.module.sass'

export interface ContributionSummaryProps {
    calendar?: ApiType.Feed.CalendarResponse
    className?: string
}

/**
 * The year of the contribution calendar in numbers: actions, active days, the longest and
 * the current run of days in a row, the busiest day. Counted from the calendar itself, so
 * it needs no request of its own. Nothing to show for a year without actions.
 */
export const ContributionSummary: React.FC<ContributionSummaryProps> = ({ calendar, className }) => {
    const { t, i18n } = useTranslation()

    const summary = useMemo(() => (calendar ? calendarSummary(calendar.items, calendar.to) : undefined), [calendar])

    if (!summary?.total) {
        return null
    }

    const stats = [
        { count: summary.total, key: 'calendar-summary-actions' },
        { count: summary.activeDays, key: 'calendar-summary-days' },
        { count: summary.longestStreak, key: 'calendar-summary-longest' },
        { count: summary.currentStreak, key: 'calendar-summary-current' }
    ]

    return (
        <div className={cn(styles.summary, className)}>
            <h2 className={styles.summaryTitle}>{t('calendar-summary-title', { defaultValue: 'Итоги года' })}</h2>

            <dl className={styles.summaryStats}>
                {stats.map((stat) => (
                    <div
                        key={stat.key}
                        className={styles.summaryStat}
                    >
                        <dt className={styles.summaryLabel}>{t(stat.key, { count: stat.count })}</dt>
                        <dd className={styles.summaryValue}>{stat.count}</dd>
                    </div>
                ))}
            </dl>

            {summary.busiestDay && (
                <p className={styles.summaryNote}>
                    {t('calendar-summary-busiest', {
                        actions: t('calendar-actions', { count: summary.busiestDay.count }),
                        date: dayjs(summary.busiestDay.date).locale(i18n.language).format('D MMMM'),
                        defaultValue: 'Самый активный день — {{date}}: {{actions}}'
                    })}
                </p>
            )}
        </div>
    )
}
