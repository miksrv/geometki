import React, { useMemo } from 'react'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { AchievementBadge, Section } from '@/components/shared'

import styles from './styles.module.sass'

/** Badges shown in the block: the best tier of each group, the newest first */
const SHOWN_BADGES = 12

const TIER_RANK: Record<string, number> = { bronze: 1, gold: 3, none: 0, silver: 2 }

interface UserAchievementsBlockProps {
    userId: string
}

/**
 * "Достижения" in the side column of the profile overview: the earned badges, one per group
 * (its best tier), and a link to the achievements tab. Renders nothing before the first one.
 */
export const UserAchievementsBlock: React.FC<UserAchievementsBlockProps> = ({ userId }) => {
    const { t } = useTranslation()

    // Prefetched with the page (loadUserPage)
    const { data } = API.useGetUserAchievementsQuery(userId)

    const earned = useMemo(() => (data?.data ?? []).filter((achievement) => !!achievement.earned_at), [data])

    const badges = useMemo(() => {
        const best = new Map<string, (typeof earned)[number]>()

        for (const achievement of earned) {
            const existing = best.get(achievement.group_slug)

            if (!existing || (TIER_RANK[achievement.tier] ?? 0) > (TIER_RANK[existing.tier] ?? 0)) {
                best.set(achievement.group_slug, achievement)
            }
        }

        return Array.from(best.values()).sort((a, b) =>
            (b.earned_at?.date ?? '').localeCompare(a.earned_at?.date ?? '')
        )
    }, [earned])

    if (!badges.length) {
        return null
    }

    return (
        <Section
            level={3}
            title={t('achievements-title')}
            action={<Link href={`/users/${userId}/achievements`}>{t('user-side-all', { count: earned.length })}</Link>}
        >
            <div className={styles.badges}>
                {badges.slice(0, SHOWN_BADGES).map((achievement) => (
                    <AchievementBadge
                        key={achievement.id}
                        achievement={achievement}
                    />
                ))}
            </div>
        </Section>
    )
}
