import React from 'react'
import { TFunction } from 'i18next'
import { Badge } from 'simple-react-ui-kit'

import { ApiType } from '@/api'

import styles from './styles.module.sass'

interface AchievementTierBadgeProps {
    tier: ApiType.Achievements.AchievementTier
    t: TFunction
}

export const AchievementTierBadge: React.FC<AchievementTierBadgeProps> = ({ tier, t }) => {
    if (tier === 'none') {
        return null
    }

    return (
        <Badge
            size={'small'}
            className={`${styles.tierChip} ${styles[`tier--${tier}`]}`}
            label={t(`achievements-tier-${tier}`)}
        />
    )
}
