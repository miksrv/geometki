import React from 'react'
import { Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { levelColors } from '@/utils/levels'

import styles from './styles.module.sass'

interface LevelBadgeProps {
    level?: number
    size?: number
    /** Shows a "Level N" tooltip on hover/focus (off by default: the mobile badge is touch only) */
    showTooltip?: boolean
}

const BORDER_WIDTH = 1

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 32, showTooltip }) => {
    const { t } = useTranslation()
    const { fill, border } = levelColors(level)
    const outerSize = size + BORDER_WIDTH * 2
    const outerHeight = Math.round(outerSize * 1.15)
    const innerHeight = Math.round(size * 1.15)

    const badge = (
        <div
            className={styles.hexagon}
            style={{ width: outerSize, height: outerHeight, backgroundColor: border }}
        >
            <div
                className={styles.hexagonInner}
                style={{ width: size, height: innerHeight, backgroundColor: fill }}
            >
                <span className={styles.level}>{level ?? 1}</span>
            </div>
        </div>
    )

    return showTooltip ? (
        <Tooltip content={t('level_num', { defaultValue: 'Уровень {{level}}', level: level ?? 1 })}>{badge}</Tooltip>
    ) : (
        badge
    )
}
