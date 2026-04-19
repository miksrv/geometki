import React, { CSSProperties } from 'react'
import { TFunction } from 'i18next'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'

import { ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'
import { TIER_COLORS } from '@/utils/achievements'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

interface AchievementDetailModalProps {
    achievement: ApiType.Achievements.Achievement
    open: boolean
    onClose: () => void
    t: TFunction
}

export const AchievementDetailModal: React.FC<AchievementDetailModalProps> = ({ achievement, open, onClose, t }) => {
    if (!open) {
        return null
    }

    const tierColor = TIER_COLORS[achievement.tier]
    const cssVars = { '--tier-color': tierColor } as CSSProperties

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role={'presentation'}
        >
            <div
                className={styles.modal}
                style={cssVars}
                onClick={(e) => e.stopPropagation()}
                role={'dialog'}
                aria-modal={'true'}
                aria-label={achievement.title}
            >
                <button
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label={t('cancel')}
                >
                    <Icon name={'Close'} />
                </button>

                <div className={styles.modalHeader}>
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
                    <div>
                        <h2 className={styles.modalTitle}>{achievement.title}</h2>
                        <span className={styles.tierChip}>{t(`achievements-tier-${achievement.tier}`)}</span>
                    </div>
                </div>

                {achievement.description && <p className={styles.modalDescription}>{achievement.description}</p>}

                {achievement.earned_at && (
                    <p className={styles.modalMeta}>
                        {t('achievements-earned-at', {
                            date: formatDate(achievement.earned_at, 'D MMMM YYYY')
                        })}
                    </p>
                )}

                {achievement.xp_bonus > 0 && (
                    <p className={styles.modalMeta}>
                        {t('achievements-xp-bonus')}: <strong>+{achievement.xp_bonus} XP</strong>
                    </p>
                )}
            </div>
        </div>
    )
}
