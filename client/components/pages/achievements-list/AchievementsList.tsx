import React, { useMemo } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementCard } from '@/components/shared'

import styles from './styles.module.sass'

const TIER_DISPLAY_ORDER: Record<ApiType.Achievements.AchievementTier, number> = {
    gold: 1,
    silver: 2,
    bronze: 3,
    none: 4
}

// Progression order within a group: bronze is first step, gold is last
const TIER_PROGRESSION: Partial<Record<ApiType.Achievements.AchievementTier, number>> = {
    bronze: 1,
    silver: 2,
    gold: 3
}

function isCompleted(a: ApiType.Achievements.Achievement): boolean {
    return !!a.earned_at || (a.progress !== null && a.progress.pct >= 100) // eslint-disable-line eqeqeq
}

function pickCurrentFromGroup(items: ApiType.Achievements.Achievement[]): ApiType.Achievements.Achievement {
    const uncompleted = items.filter((a) => !isCompleted(a))

    if (uncompleted.length > 0) {
        return uncompleted.reduce((best, a) =>
            (TIER_PROGRESSION[a.tier] ?? 0) < (TIER_PROGRESSION[best.tier] ?? 0) ? a : best
        )
    }

    return items.reduce((best, a) => ((TIER_PROGRESSION[a.tier] ?? 0) > (TIER_PROGRESSION[best.tier] ?? 0) ? a : best))
}

interface AchievementsListProps {
    achievements: ApiType.Achievements.Achievement[]
    isLoading: boolean
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements, isLoading }) => {
    const { t } = useTranslation()

    const visible = useMemo(() => {
        const groupMap = new Map<string, ApiType.Achievements.Achievement[]>()
        const ungrouped: ApiType.Achievements.Achievement[] = []

        achievements.forEach((a) => {
            if (a.group_slug) {
                const list = groupMap.get(a.group_slug) ?? []
                list.push(a)
                groupMap.set(a.group_slug, list)
            } else {
                ungrouped.push(a)
            }
        })

        const result: ApiType.Achievements.Achievement[] = [...ungrouped]
        groupMap.forEach((items) => result.push(pickCurrentFromGroup(items)))

        return result
    }, [achievements])

    const grouped = useMemo(() => {
        const map: Record<string, ApiType.Achievements.Achievement[]> = {}
        visible.forEach((a) => {
            if (!map[a.category]) {
                map[a.category] = []
            }
            map[a.category].push(a)
        })
        Object.keys(map).forEach((cat) => {
            map[cat].sort((a, b) => (TIER_DISPLAY_ORDER[a.tier] ?? 9) - (TIER_DISPLAY_ORDER[b.tier] ?? 9))
        })
        return map
    }, [visible])

    if (isLoading) {
        return (
            <div className={styles.emptyState}>
                <span>{t('show-more')}</span>
            </div>
        )
    }

    if (achievements.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>{t('achievements-noAchievements')}</p>
            </div>
        )
    }

    return (
        <>
            {Object.entries(grouped).map(([category, items]) => (
                <div
                    key={category}
                    className={styles.categoryGroup}
                >
                    <h3 className={styles.categoryGroupTitle}>{t(`achievements-category-${category}`)}</h3>
                    <div className={styles.achievementsGrid}>
                        {items.map((achievement) => (
                            <div
                                key={achievement.id}
                                className={styles.achievementsGridItem}
                            >
                                <AchievementCard
                                    achievement={achievement}
                                    showProgress={true}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    )
}
