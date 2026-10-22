import { UserLevel } from '@/api/models/userLevel'
import { LEVEL_COLORS } from '@/config/constants'

/** The tier of a level: every three levels share a colour and a name (`levelTier.<index>` in common.json) */
export const levelTier = (level?: number): number => {
    if (!level || level < 1) {
        return 0
    }
    return Math.min(Math.floor((level - 1) / 3), LEVEL_COLORS.length - 1)
}

export const levelColors = (level?: number): { fill: string; border: string } => LEVEL_COLORS[levelTier(level)]

export const levelColor = (level?: number): string => levelColors(level).fill

export type LevelProgressData = {
    /** Experience earned since the current level began */
    gained: number
    /** Experience the current level takes, from its start to the next one; undefined on the last level */
    required?: number
    /** Experience still needed for the next level, 0 on the last level */
    left: number
    /** Bar fill, 0–100, counted within the current level */
    percent: number
    isMaxLevel: boolean
}

/**
 * Progress within the current level: a new level starts the bar from zero. Without the next
 * level's threshold (the last level) the bar is full; without any level data it is empty.
 */
export const levelProgress = (levelData?: UserLevel): LevelProgressData => {
    if (levelData?.experience == null) {
        return { gained: 0, left: 0, percent: 0, isMaxLevel: false }
    }

    const experience = Math.max(levelData?.experience ?? 0, 0)
    const levelStart = Math.min(levelData?.levelExperience ?? 0, experience)
    const nextLevel = levelData?.nextLevel

    if (nextLevel == null || nextLevel <= levelStart) {
        return { gained: experience - levelStart, left: 0, percent: 100, isMaxLevel: true }
    }

    const required = nextLevel - levelStart
    const gained = Math.min(experience - levelStart, required)

    return { gained, required, left: required - gained, percent: (gained * 100) / required, isMaxLevel: false }
}
