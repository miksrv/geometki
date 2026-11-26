import React from 'react'

import { screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { HomeGame } from './HomeGame'

let mockGame: Record<string, unknown> | undefined
let mockLocation: { lat: number; lon: number } | undefined
const mockQuery = jest.fn()
const mockPlacesQuery = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useGameGetPlacesQuery: (...args: unknown[]) => mockPlacesQuery(...args),
        useGameGetQuery: (...args: unknown[]) => mockQuery(...args)
    },
    ApiModel: {},
    ApiType: {}
}))

jest.mock('@/hooks/useUserLocation', () => ({
    __esModule: true,
    default: () => ({ location: mockLocation })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('@/components/shared', () => ({
    AchievementIcon: () => <i data-testid={'badge'} />,
    GamePoints: ({ value, plus }: { value: number; plus?: boolean }) => <span>{`${plus ? '+' : ''}${value}`}</span>,
    UserAvatar: () => <i data-testid={'avatar'} />
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: () => <span data-testid={'cover'} />
}))

const places = {
    count: 1,
    items: [{ cover: { preview: 'cover.jpg' }, game: { points: 45, position: 1 }, id: 'place1', title: 'Waterfall' }]
}

const game = {
    me: { ahead: 20, place: 9, places: 2, players: 10, points: 50, quests: 0 },
    season: {
        current: true,
        daysLeft: 20,
        from: '2026-10-01',
        id: '2026-10',
        title: 'Cold season 2026/27',
        to: '2027-03-31',
        upcoming: false
    },
    totals: { places: 31, players: 10, quests: 1 }
}

const store = (role?: string) => makeTestStore({ auth: { isAuth: true, user: { id: 'u1', name: 'Alice', role } } })

describe('HomeGame', () => {
    beforeEach(() => {
        mockGame = game
        mockQuery.mockReset()
        mockQuery.mockImplementation(() => ({ data: mockGame }))
        mockLocation = undefined
        mockPlacesQuery.mockReset()
        mockPlacesQuery.mockImplementation(() => ({ data: places }))
    })

    it('is not there between seasons', () => {
        mockGame = { ...game, season: { ...game.season, current: false } }
        const { container } = renderWithStore(<HomeGame />, { store: store('admin') })

        expect(container).toBeEmptyDOMElement()
    })

    it('is not there without a season at all', () => {
        mockGame = { ...game, season: null }
        const { container } = renderWithStore(<HomeGame />, { store: store('admin') })

        expect(container).toBeEmptyDOMElement()
    })

    it('shows the season, the visitor with their geopoints and where to go next', () => {
        renderWithStore(<HomeGame />, { store: store('admin') })

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Cold season 2026/27')
        expect(screen.getByText('game-season-days-left:20')).toBeInTheDocument()

        // Where the visitor stands and how many play — and no tasks
        expect(screen.getByText('9')).toBeInTheDocument()
        expect(screen.getByText('game-season-counter-players:10')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        // The visitor: the name and the geopoints, not how far the place above is
        expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/users/u1')
        expect(screen.getByText('50')).toBeInTheDocument()
        expect(screen.queryByText(/game-season-ahead/)).not.toBeInTheDocument()

        // The next step is a place, not a button into the game
        expect(screen.getByRole('link', { name: /Waterfall/ })).toHaveAttribute(
            'href',
            expect.stringContaining('/places/place1')
        )
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'home-game-rating' })).toHaveAttribute('href', '/game')
        expect(screen.getByRole('link', { name: 'game-season-events' })).toHaveAttribute(
            'href',
            '/activity?type=visits'
        )
        expect(screen.getByRole('link', { name: 'game-rules-title' })).toHaveAttribute('href', '/game/help')
    })

    it('asks for the nearest valuable place when the location is known, without asking for it', () => {
        mockLocation = { lat: 51.7, lon: 55.1 }
        renderWithStore(<HomeGame />, { store: store() })

        expect(mockPlacesQuery).toHaveBeenLastCalledWith(
            { lat: 51.7, limit: 1, lon: 55.1, radius: 20 },
            { skip: false }
        )
    })

    it('invites someone who has not played', () => {
        mockGame = {
            ...game,
            me: { ...game.me, place: null, places: 0, points: 0 },
            totals: { ...game.totals, quests: 0 }
        }
        renderWithStore(<HomeGame />, { store: store('admin') })

        // Nobody above to stand under: their name and how to get into the rating
        expect(screen.getByText('game-season-invite')).toBeInTheDocument()
        expect(mockQuery).toHaveBeenCalledWith({ rivals: true })
        expect(screen.getByRole('link', { name: /Waterfall/ })).toBeInTheDocument()
    })
})
