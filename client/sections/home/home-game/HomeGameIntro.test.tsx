import React from 'react'

import { render, screen } from '@testing-library/react'

import { HomeGameIntro } from './HomeGameIntro'

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/components/shared', () => ({
    Section: ({ title, children }: any) => (
        <section aria-label={title}>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

jest.mock('@/sections/game/game-season', () => ({
    GameSeason: ({ season, me, links }: any) => (
        <div data-testid={'season-card'}>
            {season.title}
            {me ? 'me' : 'no-me'}
            {links.map(({ href, label }: any) => (
                <a
                    key={href}
                    href={href}
                >
                    {label}
                </a>
            ))}
        </div>
    )
}))

const game = (season: any) => ({
    awards: [],
    rules: {},
    season,
    seasons: [],
    totals: { places: 10, players: 5, quests: 1 }
})

describe('HomeGameIntro', () => {
    it('tells a guest about the game with the season card, without a visitor in it', () => {
        render(
            <HomeGameIntro
                game={game({ current: true, id: '2027-warm', title: 'Тёплый 2027', upcoming: false }) as any}
            />
        )

        expect(screen.getByRole('heading', { name: 'home-game-intro-title' })).toBeInTheDocument()
        expect(screen.getByText('home-game-intro-lede')).toBeInTheDocument()
        expect(screen.getByTestId('season-card')).toHaveTextContent('Тёплый 2027')
        expect(screen.getByTestId('season-card')).toHaveTextContent('no-me')
        expect(screen.getByRole('link', { name: 'game-rules-title' })).toHaveAttribute('href', '/game/help')
        expect(screen.getByRole('link', { name: 'game-quests-title' })).toHaveAttribute('href', '/quests')
    })

    it('announces the next season too', () => {
        render(
            <HomeGameIntro
                game={game({ current: false, id: '2027-cold', title: 'Холодный 2027', upcoming: true }) as any}
            />
        )

        expect(screen.getByTestId('season-card')).toHaveTextContent('Холодный 2027')
    })

    it('is not there without a season', () => {
        const { container } = render(<HomeGameIntro game={game(null) as any} />)

        expect(container).toBeEmptyDOMElement()
    })
})
