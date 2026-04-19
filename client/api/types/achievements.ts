export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold'
export type AchievementType = 'base' | 'seasonal'
export type AchievementCategory = 'exploration' | 'content' | 'social' | 'reputation' | 'consistency' | 'seasonal'

export interface AchievementProgress {
    current: number
    required: number
    pct: number
}

export interface Achievement {
    id: string
    group_slug: string
    type: AchievementType
    tier: AchievementTier
    category: AchievementCategory
    title: string
    description: string
    icon: string
    image?: string | null
    xp_bonus: number
    season_start: string | null
    season_end: string | null
    earned_at: string | null
    progress: AchievementProgress | null
    sort_order: number
    is_active: boolean
}

export interface AchievementRule {
    metric: string
    operator: '>='
    value: number
    filter?: { category_id?: string; tag_id?: string }
}

export interface AchievementInput {
    group_slug?: string
    type: AchievementType
    tier: AchievementTier
    category: string
    title_en: string
    title_ru: string
    description_en?: string
    description_ru?: string
    icon?: string
    image?: string | null
    rules: AchievementRule[]
    season_start?: string | null
    season_end?: string | null
    xp_bonus?: number
    sort_order?: number
    is_active?: boolean
}

/** Extended shape returned by GET /achievements/manage (admin only) */
export interface AchievementAdmin extends Achievement {
    title_en: string
    title_ru: string
    description_en: string | null
    description_ru: string | null
    rules: AchievementRule[]
}

export interface GetAchievementsParams {
    category?: string
    tier?: string
    type?: string
}
