import { ApiType } from '@/api'

import { groupAchievements, sortAchievementGroups } from './achievements'

const step = (
    group: string,
    tier: ApiType.Achievements.AchievementTier,
    earned = false,
    sortOrder = 0
): ApiType.Achievements.Achievement =>
    ({
        category: 'exploration',
        earned_at: earned ? { date: '2026-03-12 10:00:00' } : null,
        group_slug: group,
        id: `${group}-${tier}`,
        sort_order: sortOrder,
        tier,
        title: group
    }) as unknown as ApiType.Achievements.Achievement

describe('groupAchievements', () => {
    it('puts the steps of a group in order and counts the lower ones passed under an awarded higher one', () => {
        const [explorer] = groupAchievements([
            step('explorer', 'gold'),
            step('explorer', 'silver', true),
            step('explorer', 'bronze')
        ])

        expect(explorer.steps.map((s) => s.tier)).toStrictEqual(['bronze', 'silver', 'gold'])
        expect(explorer.passed).toBe(2)
        expect(explorer.achieved?.tier).toBe('silver')
        expect(explorer.next?.tier).toBe('gold')
    })

    it('has no next step once the last one is awarded, and no achieved one before the first', () => {
        const groups = groupAchievements([
            step('regular', 'gold', true),
            step('regular', 'bronze'),
            step('critic', 'bronze'),
            step('critic', 'silver')
        ])

        const regular = groups.find((group) => group.key === 'regular')
        const critic = groups.find((group) => group.key === 'critic')

        expect(regular?.passed).toBe(2)
        expect(regular?.next).toBeUndefined()
        expect(critic?.achieved).toBeUndefined()
        expect(critic?.next?.tier).toBe('bronze')
    })

    it('makes an achievement without a group a group of one, in the order of the API', () => {
        const groups = groupAchievements([step('b', 'bronze', false, 2), step('', 'none', true, 1)])

        expect(groups.map((group) => group.key)).toStrictEqual(['-none', 'b'])
        expect(groups[0].passed).toBe(1)
    })
})

describe('sortAchievementGroups', () => {
    it('puts the earned first, the highest step first, then the closest to their next step', () => {
        const withProgress = (group: string, pct: number) =>
            ({
                ...step(group, 'bronze'),
                progress: { current: pct, pct, required: 100 }
            }) as ApiType.Achievements.Achievement

        const order = sortAchievementGroups(
            groupAchievements([
                withProgress('far', 10),
                step('bronzed', 'bronze', true),
                step('bronzed', 'silver'),
                withProgress('close', 80),
                step('golden', 'bronze'),
                step('golden', 'gold', true)
            ])
        ).map((group) => group.key)

        expect(order).toStrictEqual(['golden', 'bronzed', 'close', 'far'])
    })
})
