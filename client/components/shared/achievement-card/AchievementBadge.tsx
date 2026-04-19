import React, { CSSProperties, useState } from 'react'

import { useTranslation } from 'next-i18next'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { TIER_COLORS } from '@/utils/achievements'
import { formatDate } from '@/utils/helpers'

import { AchievementDetailModal } from './AchievementDetailModal'

import styles from './styles.module.sass'

interface AchievementBadgeProps {
    achievement: ApiType.Achievements.Achievement
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement }) => {
    const { t } = useTranslation()
    const [hovered, setHovered] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    const tierColor = TIER_COLORS[achievement.tier]

    const cssVars = { '--tier-color': tierColor } as CSSProperties

    return (
        <>
            <div
                className={styles.badgeItem}
                style={cssVars}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={() => setModalOpen(true)}
                role={'button'}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
                aria-label={achievement.title}
            >
                <div className={styles.badgeIcon}>
                    <AchievementIcon
                        image={achievement.image}
                        icon={achievement.icon}
                        alt={achievement.title}
                        size={36}
                        style={{ borderRadius: '50%' }}
                    />
                </div>
                {hovered && (
                    <div
                        className={styles.badgeTooltip}
                        role={'tooltip'}
                    >
                        <div>
                            <strong>{achievement.title}</strong>
                        </div>
                        {achievement.earned_at && <div>{formatDate(achievement.earned_at, 'D MMMM YYYY')}</div>}
                    </div>
                )}
            </div>

            <AchievementDetailModal
                achievement={achievement}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                t={t}
            />
        </>
    )
}
