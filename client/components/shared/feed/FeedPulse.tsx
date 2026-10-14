import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { UserAvatarGroup } from '@/components/shared/user-avatar-group'
import { formatDate, timeAgo } from '@/utils/helpers'

import styles from './styles.module.sass'

export interface FeedPulseProps {
    pulse?: ApiType.Feed.PulseResponse
    /** One line for a narrow column (home page) instead of the row of numbers */
    compact?: boolean
    className?: string
}

/**
 * "What is going on here": the numbers of the last week (or month, when the week was
 * quiet), the people behind them and how long ago the last thing happened. The first
 * thing the feed says is that the site is alive; zero counts are left out.
 */
export const FeedPulse: React.FC<FeedPulseProps> = ({ pulse, compact, className }) => {
    const { t, i18n } = useTranslation()

    if (!pulse) {
        return null
    }

    const stats = [
        { count: pulse.places, key: 'feed-pulse-places' },
        { count: pulse.photos, key: 'feed-pulse-photos' },
        { count: pulse.comments, key: 'feed-pulse-comments' },
        { count: pulse.ratings, key: 'feed-pulse-ratings' },
        { count: pulse.collections, key: 'feed-pulse-collections' },
        { count: pulse.edits, key: 'feed-pulse-edits' }
    ].filter((stat) => stat.count > 0)

    const period =
        pulse.period === 7
            ? t('feed-pulse-week', { defaultValue: 'За неделю' })
            : t('feed-pulse-month', { defaultValue: 'За месяц' })

    const updated = pulse.updated?.date && (
        <span
            className={styles.pulseUpdated}
            title={formatDate(pulse.updated.date)}
            suppressHydrationWarning={true}
        >
            <span
                className={styles.liveDot}
                aria-hidden={true}
            />
            {t('feed-pulse-updated', {
                defaultValue: 'последнее событие {{time}}',
                time: timeAgo(pulse.updated.date, false, i18n.language)
            })}
        </span>
    )

    if (compact) {
        return (
            <div className={cn(styles.pulse, styles.pulseCompact, className)}>
                {!!stats.length && (
                    <p className={styles.pulseLine}>
                        {period}:{' '}
                        {stats
                            .slice(0, 3)
                            .map((stat) => `${stat.count} ${t(stat.key, { count: stat.count })}`)
                            .join(' · ')}
                    </p>
                )}
                {updated}
            </div>
        )
    }

    return (
        <div className={cn(styles.pulse, className)}>
            <div className={styles.pulseHeader}>
                <span className={styles.pulsePeriod}>{period}</span>
                {updated}
            </div>

            {!!stats.length && (
                <dl className={styles.pulseStats}>
                    {stats.map((stat) => (
                        <div
                            key={stat.key}
                            className={styles.pulseStat}
                        >
                            <dt className={styles.pulseLabel}>{t(stat.key, { count: stat.count })}</dt>
                            <dd className={styles.pulseValue}>{stat.count}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {!!pulse.users.length && (
                <div className={styles.pulsePeople}>
                    <UserAvatarGroup users={pulse.users} />
                    <span className={styles.pulsePeopleText}>
                        {t('feed-pulse-authors', {
                            count: pulse.authors,
                            defaultValue: '{{count}} участников сделали это'
                        })}
                    </span>
                </div>
            )}
        </div>
    )
}
