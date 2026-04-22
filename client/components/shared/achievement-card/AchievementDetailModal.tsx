import React from 'react'
import { TFunction } from 'i18next'
import { Dialog, Icon } from 'simple-react-ui-kit'

import { ApiType } from '@/api'
import { AchievementTierBadge } from '@/components/shared/achievement-card/AchievementTierBadge'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

interface AchievementDetailModalProps {
    achievement: ApiType.Achievements.Achievement
    open: boolean
    onClose: () => void
    t: TFunction
}

export const AchievementDetailModal: React.FC<AchievementDetailModalProps> = ({ achievement, open, onClose, t }) => (
    <Dialog
        open={open}
        maxWidth={'420px'}
        showOverlay={true}
        contentClassName={styles[`modalContent--${achievement.tier}`]}
        onCloseDialog={onClose}
    >
        <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('cancel')}
        >
            <Icon name={'Close'} />
        </button>

        <div className={styles.modalHeader}>
            <AchievementIcon
                image={achievement.image}
                alt={achievement.title}
                size={48}
            />
            <div>
                <h2 className={styles.modalTitle}>{achievement.title}</h2>
                <AchievementTierBadge
                    tier={achievement.tier}
                    t={t}
                />
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
    </Dialog>
)
