import { ApiType } from '@/api'

export const TIER_COLORS: Record<ApiType.Achievements.AchievementTier, string> = {
    bronze: '#cd7f32',
    gold: '#ffd700',
    none: 'var(--icon-color-secondary)',
    silver: '#c0c0c0'
}
