import React, { CSSProperties } from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next'

import { ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'
import { TIER_COLORS } from '@/utils/achievements'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

interface AchievementCardProps {
    achievement: ApiType.Achievements.Achievement
    showProgress?: boolean
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement, showProgress }) => {
    const { t } = useTranslation()

    const tierColor = TIER_COLORS[achievement.tier]

    const cssVars = { '--tier-color': tierColor } as CSSProperties

    return (
        <div
            className={`${styles.achievementCard} ${achievement.earned_at ? styles.earnedCard : ''}`}
            style={cssVars}
        >
            <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                    {achievement.image ? (
                        <Image
                            src={`${IMG_HOST}${achievement.image}`}
                            alt={achievement.title}
                            width={36}
                            height={36}
                            style={{ objectFit: 'contain' }}
                        />
                    ) : (
                        <Icon name={achievement.icon as IconTypes} />
                    )}
                </div>
                <div className={styles.cardMeta}>
                    <p className={styles.cardTitle}>{achievement.title}</p>
                    <span className={styles.tierChip}>{t(`achievements-tier-${achievement.tier}`)}</span>
                </div>
            </div>

            {achievement.description && <p className={styles.cardDescription}>{achievement.description}</p>}

            {showProgress && achievement.progress && !achievement.earned_at && (
                <div className={styles.progressSection}>
                    <div className={styles.progressLabel}>
                        <span>{t('achievements-progress')}</span>
                        <span>
                            {achievement.progress.current} / {achievement.progress.required}
                        </span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${Math.min(achievement.progress.pct, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {achievement.earned_at && (
                <div className={styles.earnedBadge}>
                    <Icon name={'CheckCircle'} />
                    {t('achievements-earned-at', { date: formatDate(achievement.earned_at, 'D MMMM YYYY') })}
                </div>
            )}

            {achievement.xp_bonus > 0 && (
                <div className={styles.xpBonus}>
                    <Icon name={'StarFilled'} />
                    {`+${achievement.xp_bonus} XP`}
                </div>
            )}
        </div>
    )
}
