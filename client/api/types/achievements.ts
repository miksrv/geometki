import { DateTime } from '@/api/types/index'

export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold'
export type AchievementType = 'base' | 'seasonal'

/** One rule of an achievement: the person's real count of its metric and the threshold */
export interface AchievementRuleProgress {
    /** `achievements-metric-<metric>` names it */
    metric: string
    current: number
    required: number
}

export interface AchievementProgress {
    /** The rules summed, each capped at its threshold: one bar, never read for several rules */
    current: number
    required: number
    pct: number
    /** Each rule apart (absent in an answer cached before it came) */
    rules?: AchievementRuleProgress[]
}

export interface Achievement {
    id: string
    group_slug: string
    type: AchievementType
    tier: AchievementTier
    title: string
    description: string
    image?: string | null
    xp_bonus: number
    season_start: string | null
    season_end: string | null
    earned_at: DateTime
    /** Only in one achievement's answer (`users/:id/achievements/:group`) and the own list: the list of a profile counts nothing */
    progress?: AchievementProgress | null
    sort_order: number
    is_active: boolean
}

export interface AchievementRule {
    metric: string
    operator: '>='
    value: number
    /** `season` — the season of a `season_*` metric (`2026-autumn`); `quest_id` — one quest of `quests_walked` */
    filter?: { category_id?: string; tag_id?: string; season?: string; quest_id?: string }
}

export interface AchievementInput {
    group_slug?: string
    type: AchievementType
    tier: AchievementTier
    title_en: string
    title_ru: string
    description_en?: string
    description_ru?: string
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
    /** How many users have earned it */
    holders: number
    created_at: string | null
}

/** One line of `GET /achievements/manage/recent`: who earned which award, and when (`Y-m-d H:i:s`) */
export interface AchievementRecent {
    id: string
    earned_at: string
    achievement: Pick<Achievement, 'id' | 'title' | 'image' | 'tier' | 'group_slug'>
    user: { id: string; name: string; avatar: string | null; levelData?: { level: number } }
}
