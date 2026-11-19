import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { GamePastSeasons } from './GamePastSeasons'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('@/components/shared', () => ({
    AchievementIcon: ({ group }: { group: string }) => <i data-testid={'badge'}>{group}</i>,
    UserAvatarGroup: ({ users }: { users: Array<{ name: string }> }) => (
        <i data-testid={'podium'}>{users.map(({ name }) => name).join(',')}</i>
    )
}))

const past = (id: string, title: string, year: number): ApiType.Game.GetResponse['seasons'][number] =>
    ({
        closed: true,
        current: false,
        daysLeft: 0,
        from: `${year}-04-01`,
        id,
        slug: 'teplyy-sezon',
        title,
        lastDay: `${year}-10-07`,
        places: 72,
        players: 9,
        to: `${year}-09-30`,
        winners: [{ place: 1, places: 21, points: 695, quests: 0, user: { id: 'u1', name: 'greenexp' } }],
        upcoming: false,
        medals: { bronze: null, gold: null, participant: null, silver: null },
        image: null,
        description: null
    }) as ApiType.Game.GetResponse['seasons'][number]

describe('GamePastSeasons', () => {
    it('shows the last closed season only, a link to its page with the podium', () => {
        render(
            <GamePastSeasons
                seasons={[past('2026-04', 'Warm season 2026', 2026), past('2025-10', 'Cold season 2025/26', 2025)]}
            />
        )

        expect(screen.getByRole('link', { name: 'Warm season 2026' })).toHaveAttribute(
            'href',
            '/game/seasons/2026-04-teplyy-sezon'
        )
        expect(screen.queryByText(/Cold season/)).not.toBeInTheDocument()
        expect(screen.getAllByTestId('badge')).toHaveLength(1)
        expect(screen.getByTestId('podium')).toHaveTextContent('greenexp')
    })

    it('renders nothing before the first season is over', () => {
        const { container } = render(<GamePastSeasons seasons={[]} />)

        expect(container).toBeEmptyDOMElement()
    })
})
