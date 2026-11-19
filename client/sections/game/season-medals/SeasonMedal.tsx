import React from 'react'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'

interface SeasonMedalProps {
    kind: ApiType.Game.MedalKind
    /** The drawn medal of the season; the badge drawn in its place without one */
    image?: string | null
    size?: number
    alt?: string
    className?: string
}

/**
 * One medal of a season: its own picture, or until it is made the drawn badge — gold, silver
 * and bronze by the rim, the participant's one neutral grey.
 */
export const SeasonMedal: React.FC<SeasonMedalProps> = ({ kind, image, size = 64, alt = '', className }) => (
    <AchievementIcon
        image={image}
        alt={alt}
        size={size}
        tier={kind === 'participant' ? 'none' : kind}
        category={kind === 'participant' ? 'neutral' : 'seasonal'}
        className={className}
    />
)
