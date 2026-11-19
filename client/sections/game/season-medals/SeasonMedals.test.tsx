import React from 'react'

import { render, screen } from '@testing-library/react'

import { SeasonMedals } from './SeasonMedals'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

jest.mock('@/components/shared', () => ({
    AchievementIcon: ({ image, tier, category }: { image?: string | null; tier?: string; category?: string }) => (
        <i
            data-testid={'medal'}
            data-image={image ?? ''}
            data-tier={tier}
            data-category={category}
        />
    ),
    Section: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

const medals = { bronze: null, gold: 'seasons/gold.png', participant: null, silver: null }

describe('SeasonMedals', () => {
    it('shows the four medals with their captions', () => {
        render(<SeasonMedals medals={medals} />)

        expect(screen.getByRole('heading', { name: 'game-medals-title' })).toBeInTheDocument()
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            'game-medal-gold',
            'game-medal-silver',
            'game-medal-bronze',
            'game-medal-participant'
        ])
    })

    it('draws the badge in place of a medal that is not made, grey for the participant', () => {
        render(<SeasonMedals medals={medals} />)

        const [gold, silver, , participant] = screen.getAllByTestId('medal')

        expect(gold).toHaveAttribute('data-image', 'seasons/gold.png')
        expect(silver).toHaveAttribute('data-image', '')
        expect(silver).toHaveAttribute('data-tier', 'silver')
        expect(participant).toHaveAttribute('data-tier', 'none')
        expect(participant).toHaveAttribute('data-category', 'neutral')
    })

    it('marks the own medal of the visitor', () => {
        render(
            <SeasonMedals
                medals={medals}
                mine={'bronze'}
            />
        )

        const current = screen.getAllByRole('listitem').filter((item) => item.getAttribute('aria-current') === 'true')

        expect(current).toHaveLength(1)
        expect(current[0]).toHaveTextContent('game-medal-bronze')
        expect(current[0]).toHaveTextContent('game-medal-yours')
    })
})
