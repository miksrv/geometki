import { ApiType } from '@/api'

export const TIER_COLORS: Record<ApiType.Achievements.AchievementTier, string> = {
    bronze: '#cd7f32',
    gold: '#ffd700',
    none: 'var(--icon-color-secondary)',
    silver: '#c0c0c0'
}

type Achievement = ApiType.Achievements.Achievement

/** The steps of a group from the first to the last; a single achievement has the tier `none` */
const TIER_STEP: Record<ApiType.Achievements.AchievementTier, number> = { bronze: 1, gold: 3, none: 0, silver: 2 }

/** One achievement with all its steps (bronze → silver → gold), as the profile shows it */
export type AchievementGroup = {
    /** `group_slug`, or the id of an achievement without a group */
    key: string
    category: ApiType.Achievements.AchievementCategory
    /** From the first step to the last */
    steps: Achievement[]
    /** How many steps are passed: a higher step counts the lower ones as passed, even when only it was awarded */
    passed: number
    /** The highest step awarded */
    achieved?: Achievement
    /** The step to work on; none when every step is passed */
    next?: Achievement
}

/**
 * The achievements of a person as groups of steps. The server awards a step without the lower
 * ones when the person jumps past them, so the passed steps are counted up to the highest
 * awarded. Groups keep the order of the API's `sort_order` of their first step.
 */
export const groupAchievements = (achievements: Achievement[]): AchievementGroup[] => {
    const groups = new Map<string, Achievement[]>()

    for (const achievement of [...achievements].sort((a, b) => a.sort_order - b.sort_order)) {
        const key = achievement.group_slug || achievement.id
        groups.set(key, [...(groups.get(key) ?? []), achievement])
    }

    return Array.from(groups, ([key, items]) => {
        const steps = [...items].sort((a, b) => TIER_STEP[a.tier] - TIER_STEP[b.tier])
        const achievedIndex = steps.reduce((found, step, index) => (step.earned_at ? index : found), -1)

        return {
            achieved: achievedIndex >= 0 ? steps[achievedIndex] : undefined,
            category: steps[0].category,
            key,
            next: steps[achievedIndex + 1],
            passed: achievedIndex + 1,
            steps
        }
    })
}

/**
 * The order of the achievements tab: the earned ones first — the highest tier first, then the
 * newest — then the ones in progress, the closest to their next step first.
 */
export const sortAchievementGroups = (groups: AchievementGroup[]): AchievementGroup[] => {
    const earned = groups
        .filter((group) => !!group.achieved)
        .sort(
            (a, b) =>
                b.passed - a.passed ||
                (b.achieved?.earned_at?.date ?? '').localeCompare(a.achieved?.earned_at?.date ?? '')
        )

    const inProgress = groups
        .filter((group) => !group.achieved)
        .sort((a, b) => (b.next?.progress?.pct ?? 0) - (a.next?.progress?.pct ?? 0))

    return [...earned, ...inProgress]
}
