import React, { CSSProperties, useState } from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next'

import { ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'
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
                    {achievement.image ? (
                        <Image
                            src={`${IMG_HOST}${achievement.image}`}
                            alt={achievement.title}
                            width={36}
                            height={36}
                            style={{ borderRadius: '50%', objectFit: 'contain' }}
                        />
                    ) : (
                        <Icon name={achievement.icon as IconTypes} />
                    )}
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
