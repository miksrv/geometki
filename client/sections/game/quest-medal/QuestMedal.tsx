import React from 'react'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { questCoverSrc } from '@/utils/game'

interface QuestMedalProps {
    quest: Pick<ApiType.Game.Quest, 'cover' | 'medal' | 'mode'>
    size?: number
    alt?: string
    className?: string
}

/**
 * The award of a quest walked to the end: its own medal, or until it is made the hexagon of an
 * award without a tier around the cover of the quest's first point (a riddle quest: its drawn
 * cover, the places stay secret); the drawn quest badge when there is no cover at all.
 */
export const QuestMedal: React.FC<QuestMedalProps> = ({ quest, size = 64, alt = '', className }) => (
    <AchievementIcon
        image={quest.medal}
        alt={alt}
        size={size}
        tier={'none'}
        category={'quest'}
        group={'quest-medal'}
        photo={questCoverSrc(quest, true)}
        className={className}
    />
)
