import React, { useState } from 'react'
import { Tooltip } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

const AchievementDetailModal = dynamic(
    () => import('./AchievementDetailModal').then((m) => ({ default: m.AchievementDetailModal })),
    { ssr: false }
)

interface AchievementBadgeProps {
    achievement: ApiType.Achievements.Achievement
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement }) => {
    const { t } = useTranslation()
    const [modalOpen, setModalOpen] = useState(false)

    const tooltipContent = (
        <>
            <div>
                <strong>{achievement.title}</strong>
            </div>
            {achievement.earned_at && (
                <div>
                    {t('achievements-earned-at', {
                        defaultValue: 'Получено {{date}}',
                        date: formatDate(achievement.earned_at.date, 'D MMMM YYYY')
                    })}
                </div>
            )}
        </>
    )

    return (
        <>
            <Tooltip content={tooltipContent}>
                <div
                    className={`${styles.badgeItem} ${styles[`tier--${achievement.tier}`]}`}
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
                </div>
            </Tooltip>

            {modalOpen && (
                <AchievementDetailModal
                    achievement={achievement}
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    t={t}
                />
            )}
        </>
    )
}
