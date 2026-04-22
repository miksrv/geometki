import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { ApiType } from '@/api'
import { AchievementTierBadge } from '@/components/shared/achievement-card/AchievementTierBadge'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

interface AchievementCardProps {
    achievement: ApiType.Achievements.Achievement
    showProgress?: boolean
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement, showProgress }) => {
    const { t } = useTranslation()

    return (
        <div
            className={`${styles.achievementCard} ${styles[`tier--${achievement.tier}`]} ${achievement.earned_at ? styles.earnedCard : ''}`}
        >
            <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                    <AchievementIcon
                        image={achievement.image}
                        alt={achievement.title}
                        size={36}
                    />
                </div>
                <div className={styles.cardMeta}>
                    <p className={styles.cardTitle}>{achievement.title}</p>
                    <AchievementTierBadge
                        tier={achievement.tier}
                        t={t}
                    />
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
