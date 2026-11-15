import React, { useMemo } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { AchievementBadge } from '@/components/shared'
import { groupAchievements } from '@/utils/achievements'

import styles from './styles.module.sass'

/** Badges shown in the block: the best tier of each group, the newest first */
const SHOWN_BADGES = 12

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

    // One per achievement, as the rows of the achievements tab: "Все N" names that tab's rows
    const groups = useMemo(() => groupAchievements(data?.data ?? []), [data])

    // The highest step of each earned achievement, the newest first
    const badges = useMemo(
        () =>
            groups
                .flatMap((group) => (group.achieved ? [group.achieved] : []))
                .sort((a, b) => (b.earned_at?.date ?? '').localeCompare(a.earned_at?.date ?? '')),
        [groups]
    )

    if (!badges.length) {
        return null
    }

    return (
        <Container
            title={t('achievements-title')}
            action={<Link href={`/users/${userId}/achievements`}>{t('user-side-all', { count: groups.length })}</Link>}
        >
            <div className={cn(styles.badges, styles.body)}>
                {badges.slice(0, SHOWN_BADGES).map((achievement) => (
                    <AchievementBadge
                        key={achievement.id}
                        achievement={achievement}
                    />
                ))}
            </div>
        </Container>
    )
}
