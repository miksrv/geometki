import React, { useMemo } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { EmptyState } from '@/components/shared'
import { groupAchievements, sortAchievementGroups } from '@/utils/achievements'

import { AchievementRow } from './AchievementRow'

import styles from './styles.module.sass'

interface UserAchievementsProps {
    achievements: ApiType.Achievements.Achievement[]
    loading?: boolean
}

/**
 * The achievements tab of the profile: one list of rows, one per achievement with all its
 * steps — the earned ones first, then the ones in progress, the closest to their next step first.
 */
export const UserAchievements: React.FC<UserAchievementsProps> = ({ achievements, loading }) => {
    const { t } = useTranslation()

    const groups = useMemo(() => sortAchievementGroups(groupAchievements(achievements)), [achievements])

    if (loading && !achievements.length) {
        return null
    }

    if (!groups.length) {
        return (
            <EmptyState
                title={t('achievements-noAchievements')}
                description={t('achievements-empty-text')}
            />
        )
    }

    return (
        <ul
            className={styles.list}
            aria-label={t('achievements-title')}
        >
            {groups.map((group) => (
                <AchievementRow
                    key={group.key}
                    group={group}
                />
            ))}
        </ul>
    )
}
