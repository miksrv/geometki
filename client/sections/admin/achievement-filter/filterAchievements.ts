import { ApiType } from '@/api'

export interface AchievementFilter {
    /** `on` — the awards that are given, `off` — the switched-off ones */
    state?: string
    type?: string
    /** A text searched over the titles in both languages and the group */
    query?: string
}

/** The admin list of achievements narrowed by state, type and a text over the titles (no request) */
export const filterAchievements = (
    achievements: ApiType.Achievements.AchievementAdmin[] | undefined,
    { state, type, query }: AchievementFilter
): ApiType.Achievements.AchievementAdmin[] | undefined => {
    const needle = query?.trim().toLowerCase()

    return achievements?.filter(
        (achievement) =>
            (state !== 'on' || achievement.is_active) &&
            (state !== 'off' || !achievement.is_active) &&
            (!type || achievement.type === type) &&
            (!needle ||
                [achievement.title, achievement.title_ru, achievement.title_en, achievement.group_slug].some((text) =>
                    text?.toLowerCase().includes(needle)
                ))
    )
}
