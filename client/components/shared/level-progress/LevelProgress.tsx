import React from 'react'

import { ApiModel } from '@/api'
import { formatThousands } from '@/utils/helpers'
import { levelColor, nextLevelPercentage } from '@/utils/levels'

import { LevelBadge } from '../level-badge/LevelBadge'

import styles from './styles.module.sass'

interface LevelProgressProps {
    levelData?: ApiModel.UserLevel
    badgeSize?: number
}

export const LevelProgress: React.FC<LevelProgressProps> = ({ levelData, badgeSize = 22 }) => {
    const level = levelData?.level
    const experience = levelData?.experience ?? 0
    const nextLevel = levelData?.nextLevel ?? experience
    const pct = nextLevelPercentage(experience, nextLevel)
    const color = levelColor(level)

    return (
        <div className={styles.levelProgress}>
            <LevelBadge
                level={level}
                size={badgeSize}
                showTooltip={true}
            />
            <div className={styles.levelInfo}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                </div>
                <span className={styles.xpRange}>
                    {formatThousands(experience)} / {formatThousands(nextLevel)}
                </span>
            </div>
        </div>
    )
}
