import React, { useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared/achievement-icon'
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

    return (
        <>
            <div
                className={`${styles.badgeItem} ${styles[`tier--${achievement.tier}`]}`}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={() => setModalOpen(true)}
                role={'button'}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
                aria-label={achievement.title}
            >
                <AchievementIcon
                    image={achievement.image}
                    alt={achievement.title}
                    size={58}
                />
                {hovered && (
                    <div
                        className={styles.badgeTooltip}
                        role={'tooltip'}
                    >
                        <div>
                            <strong>{achievement.title}</strong>
                        </div>
                        {achievement.earned_at && <div>{formatDate(achievement.earned_at.date, 'D MMMM YYYY')}</div>}
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
