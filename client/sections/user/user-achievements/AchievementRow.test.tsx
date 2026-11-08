import React from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'
import { groupAchievements } from '@/utils/achievements'

import { AchievementRow } from './AchievementRow'

dayjs.extend(utc)

jest.mock('simple-react-ui-kit', () => ({
    cn: (...names: unknown[]) => names.filter(Boolean).join(' '),
    Icon: () => null
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, string | number>) =>
            opts ? `${key}(${Object.values(opts).join(',')})` : key
    })
}))

jest.mock('@/components/shared/achievement-icon', () => ({
    AchievementIcon: () => <span data-testid={'medal'} />
}))

const step = (
    tier: ApiType.Achievements.AchievementTier,
    fields: Partial<ApiType.Achievements.Achievement> = {}
): ApiType.Achievements.Achievement =>
    ({
        category: 'exploration',
        description: `Add places: ${tier}`,
        earned_at: null,
        group_slug: 'explorer',
        id: `explorer-${tier}`,
        progress: null,
        sort_order: 1,
        tier,
        title: 'Explorer',
        xp_bonus: tier === 'gold' ? 150 : 25,
        ...fields
    }) as ApiType.Achievements.Achievement

const renderRow = (achievements: ApiType.Achievements.Achievement[]) =>
    render(
        <ul>
            <AchievementRow group={groupAchievements(achievements)[0]} />
        </ul>
    )

describe('AchievementRow', () => {
    it('shows the category, the tier passed, the next goal with its progress and the steps', () => {
        renderRow([
            step('bronze'),
            step('silver', { earned_at: { date: '2026-03-12 10:00:00' } as ApiType.DateTime }),
            step('gold', { progress: { current: 101, pct: 50.5, required: 200 } })
        ])

        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Explorer')
        expect(screen.getByText('achievements-category-exploration')).toBeInTheDocument()
        expect(screen.getByText(/^achievements-tier-earned\(/)).toBeInTheDocument()
        expect(screen.getByText('Add places: gold')).toBeInTheDocument()
        expect(screen.getByText('101 / 200')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '51')
        expect(screen.getByRole('list', { name: 'achievements-steps(2,3)' }).querySelectorAll('li')).toHaveLength(3)
        expect(screen.getByText('achievements-tier-gold · achievements-step-xp(150)')).toBeInTheDocument()
    })

    it('says all the steps are passed, with no progress, once the last one is earned', () => {
        renderRow([
            step('bronze'),
            step('silver'),
            step('gold', { earned_at: { date: '2026-03-12 10:00:00' } as ApiType.DateTime })
        ])

        expect(screen.getByText('achievements-all-passed')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('says nothing is earned yet before the first step, and a single step has no dots', () => {
        renderRow([step('bronze', { progress: { current: 3, pct: 30, required: 10 } })])

        expect(screen.getByText('achievements-not-yet')).toBeInTheDocument()
        expect(screen.queryByRole('list', { name: /achievements-steps/ })).not.toBeInTheDocument()
    })
})
