import React from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { Section } from '@/components/shared'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

interface UserContributionProps {
    statistic?: ApiModel.UserStatistic
}

/**
 * "Вклад" in the side column of the profile overview: what the person did besides the places,
 * photos and visited places of the card's counters — ratings, reviews, edits. (Check-ins are
 * the "Визиты" of the "Места" tab, next to the visited places they add up to.)
 * Renders nothing while all of them are zero.
 */
export const UserContribution: React.FC<UserContributionProps> = ({ statistic }) => {
    const { t } = useTranslation()

    const rows: Array<{ key: string; icon: IconTypes; count: number }> = [
        { count: statistic?.rating ?? 0, icon: 'StarEmpty', key: 'ratings' },
        { count: statistic?.comment ?? 0, icon: 'Comment', key: 'reviews' },
        { count: statistic?.edit ?? 0, icon: 'Pencil', key: 'edits' }
    ]

    if (!rows.some(({ count }) => count > 0)) {
        return null
    }

    return (
        <Section
            level={3}
            title={t('user-side-contribution')}
        >
            <ul className={styles.rows}>
                {rows.map(({ key, icon, count }) => (
                    <li key={key}>
                        <Icon name={icon} />
                        <span className={styles.label}>{t(`user-side-${key}`)}</span>
                        <b>{formatThousands(count)}</b>
                    </li>
                ))}
            </ul>
        </Section>
    )
}
