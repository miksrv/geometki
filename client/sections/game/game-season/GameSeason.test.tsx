import React from 'react'

import { fireEvent, screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'
import { ApiType } from '@/api'

import { GameSeason } from './GameSeason'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('@/components/shared', () => ({
    AchievementIcon: ({ group }: { group: string }) => <i data-testid={'badge'}>{group}</i>,
    GamePoints: ({ value, plus }: { value: number; plus?: boolean }) => (
        <span data-testid={'points'}>{`${plus ? '+' : ''}${value}`}</span>
    ),
    UserAvatar: ({ user }: { user: { name: string } }) => <i data-testid={'avatar'}>{user.name}</i>
}))

jest.mock('next/router', () => ({
    useRouter: () => ({ asPath: '/game', replace: jest.fn() })
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src }: { src: string }) => (
        <span
            data-testid={'cover'}
            data-src={src}
        />
    )
}))

const season: ApiType.Game.Season = {
    closed: false,
    current: true,
    daysLeft: 20,
    from: '2026-10-01',
    id: '2026-cold',
    key: 'cold',
    lastDay: '2027-04-07',
    to: '2027-03-31',
    year: 2026
}

const totals = { places: 31, players: 10, quests: 1 }

const leader = (place: number, points: number, id: string, name: string): ApiType.Game.Leader => ({
    place,
    places: 1,
    points,
    quests: 0,
    user: { id, name }
})

const next = {
    cover: { preview: 'cover.jpg' },
    distance: 3,
    game: { points: 45, position: 1 },
    id: 'place1',
    title: 'Waterfall'
} as ApiType.Game.ValuablePlace

const signedIn = () => makeTestStore({ auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } } })

describe('GameSeason', () => {
    it('shows where the player stands and how many play, as plain tiles', () => {
        renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
                me={{ ahead: 20, place: 9, places: 2, players: 10, points: 50, quests: 0 }}
            />,
            { store: signedIn() }
        )

        expect(screen.getByRole('heading', { level: 1, name: 'game-season-cold:2026/27' })).toBeInTheDocument()
        expect(screen.getByTestId('badge')).toHaveTextContent('season-2026-cold')
        expect(screen.getByText('game-season-days-left:20')).toBeInTheDocument()
        // The page's card ends with the head: the rating and the places are the page's own blocks
        expect(screen.queryByRole('link', { name: 'Alice' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('points')).not.toBeInTheDocument()

        const counters = screen.getByRole('group', { name: 'game-season-counters' })

        expect(counters).toHaveTextContent('9game-season-counter-place')
        expect(counters).toHaveTextContent('10game-season-counter-players:10')
        // Information only: the tiles lead nowhere
        expect(counters.querySelector('a')).toBeNull()

        // A season has no award to reach: the bar of its time is not a progress bar
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        expect(screen.queryByText('game-season-sign-in')).not.toBeInTheDocument()
    })

    it('shows the totals of the season to someone who has not played, and the sign-in to a guest', () => {
        const { store } = renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
            />,
            { store: makeTestStore({ auth: { isAuth: false, user: undefined } }) }
        )

        // A guest has no place: only how many play
        expect(screen.getByText('game-season-counter-players:10')).toBeInTheDocument()
        expect(screen.queryByText('game-season-counter-place')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('game-season-sign-in'))
        expect(store.getState().application.showAuthDialog).toBe(true)
    })

    it('is the h1 on the page of its season', () => {
        renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
                me={{ ahead: null, place: 1, places: 6, players: 10, points: 300, quests: 1 }}
            />,
            { store: signedIn() }
        )

        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
        // The first one has nobody above
        expect(screen.queryByText(/game-season-ahead/)).not.toBeInTheDocument()
    })

    it('is a simpler card on the home page: a section title that leads to the game, no dates', () => {
        renderWithStore(
            <GameSeason
                variant={'home'}
                season={season}
                totals={totals}
                me={{ ahead: 20, place: 9, places: 2, players: 10, points: 50, quests: 0 }}
            >
                <button>{'into the game'}</button>
            </GameSeason>,
            { store: signedIn() }
        )

        expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /game-season-cold/ })).toHaveAttribute('href', '/game')
        // The same counters as on the game page
        expect(screen.getByText('game-season-counter-place')).toBeInTheDocument()
        expect(screen.getByText('game-season-counter-players:10')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'into the game' })).toBeInTheDocument()
    })

    it('shows two lines of the table on the home page: the player above and the visitor', () => {
        renderWithStore(
            <GameSeason
                variant={'home'}
                season={season}
                totals={totals}
                me={{
                    ahead: 20,
                    behind: 5,
                    place: 9,
                    places: 2,
                    players: 10,
                    points: 50,
                    rivals: { above: leader(8, 70, 'u8', 'Ivan'), below: leader(10, 45, 'u10', 'Olga') },
                    quests: 0
                }}
                links={[
                    { href: '/game', label: 'ratings' },
                    { href: '/game/help', label: 'how to play' }
                ]}
            />,
            { store: signedIn() }
        )

        expect(screen.getByRole('link', { name: 'ratings' })).toHaveAttribute('href', '/game')
        expect(screen.getByRole('link', { name: 'how to play' })).toHaveAttribute('href', '/game/help')
        const rows = screen.getByRole('list', { name: 'game-season-rivals' }).querySelectorAll('li')

        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('8')
        expect(rows[0]).toHaveTextContent('70')
        expect(screen.getByRole('link', { name: 'Ivan' })).toHaveAttribute('href', '/users/u8')
        // The own line carries the name, not "Вы"
        expect(rows[1]).toHaveTextContent('9')
        expect(rows[1]).toHaveTextContent('Alice')
        expect(rows[1]).toHaveTextContent('50')
        // How far the place above is and the one below are the page's
        expect(screen.queryByText(/game-season-ahead/)).not.toBeInTheDocument()
        expect(screen.queryByText('Olga')).not.toBeInTheDocument()
    })

    it('has neither the table nor the next place on the page', () => {
        renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
                next={next}
                me={{
                    ahead: 20,
                    place: 9,
                    places: 2,
                    players: 10,
                    points: 50,
                    rivals: { above: leader(8, 70, 'u8', 'Ivan') },
                    quests: 0
                }}
            />,
            { store: signedIn() }
        )

        expect(screen.queryByRole('list', { name: 'game-season-rivals' })).not.toBeInTheDocument()
        expect(screen.queryByText('Waterfall')).not.toBeInTheDocument()
    })

    it('lets an administrator replace the picture by a tap on it, on the page only', () => {
        const admin = () => makeTestStore({ auth: { isAuth: true, user: { id: 'u1', name: 'Alice', role: 'admin' } } })
        const { unmount } = renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
            />,
            { store: admin() }
        )

        expect(screen.getByRole('button', { name: 'game-season-image' })).toContainElement(screen.getByTestId('badge'))
        unmount()

        renderWithStore(
            <GameSeason
                variant={'home'}
                season={season}
                totals={totals}
            />,
            { store: admin() }
        )

        expect(screen.queryByRole('button', { name: 'game-season-image' })).not.toBeInTheDocument()
        unmount()

        renderWithStore(
            <GameSeason
                season={season}
                totals={totals}
            />,
            { store: signedIn() }
        )

        expect(screen.queryByRole('button', { name: 'game-season-image' })).not.toBeInTheDocument()
    })

    it('offers the next place with what a check-in there gives, and says when it is enough to go up', () => {
        const { unmount } = renderWithStore(
            <GameSeason
                variant={'home'}
                season={season}
                totals={totals}
                next={next}
                me={{ ahead: 20, place: 9, places: 2, players: 10, points: 50, quests: 0 }}
            />,
            { store: signedIn() }
        )

        const link = screen.getByRole('link', { name: /Waterfall/ })

        expect(link).toHaveAttribute('href', expect.stringContaining('/places/place1'))
        expect(link).toHaveTextContent('+45')
        expect(link).toHaveTextContent('3 km')
        // 45 is more than the 20 to the place above
        expect(link).toHaveTextContent('game-season-next-enough:8')
        unmount()

        // Someone who has not played has the same look: under the last player, without a place
        renderWithStore(
            <GameSeason
                variant={'home'}
                season={season}
                totals={totals}
                next={next}
                me={{
                    ahead: null,
                    place: null,
                    places: 0,
                    players: 10,
                    points: 0,
                    rivals: { above: leader(10, 45, 'u10', 'Olga') },
                    quests: 0
                }}
            />,
            { store: signedIn() }
        )

        const rows = screen.getByRole('list', { name: 'game-season-rivals' }).querySelectorAll('li')

        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('Olga')
        expect(rows[1]).toHaveTextContent('—')
        expect(rows[1]).toHaveTextContent('Alice')
        expect(screen.getByRole('link', { name: /Waterfall/ })).toHaveTextContent('game-season-next-first')
        expect(screen.getByRole('group', { name: 'game-season-counters' })).toHaveTextContent(
            '—game-season-counter-place'
        )
    })

    it('has no days left and no next step once the season is closed', () => {
        renderWithStore(
            <GameSeason
                season={{ ...season, closed: true, current: false, daysLeft: 0 }}
                totals={totals}
                next={next}
            />,
            { store: signedIn() }
        )

        expect(screen.getByText('game-season-closed')).toBeInTheDocument()
        expect(screen.queryByText(/game-season-days-left/)).not.toBeInTheDocument()
        expect(screen.queryByText('Waterfall')).not.toBeInTheDocument()
    })
})
