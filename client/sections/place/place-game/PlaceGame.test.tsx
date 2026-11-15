import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ApiType } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'
import { localPlainDate } from '@/utils/date'

import { PlaceGame } from './PlaceGame'

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }))
jest.mock('../../../next-i18next.config', () => ({ i18n: { defaultLocale: 'ru' } }))
jest.mock('cookies-next', () => ({ deleteCookie: jest.fn(), getCookie: jest.fn(), setCookie: jest.fn() }))

const mockPost = jest.fn()
const mockPosition = jest.fn()
let mockGame: ApiType.Game.PlaceGame | null | undefined
let mockItems: Array<{ id: string; visitedAt: string }> = []

jest.mock('@/api', () => ({
    API: {
        useVisitsGetMeQuery: () => ({
            data:
                mockGame === undefined
                    ? { count: 0, items: [] }
                    : { count: mockItems.length, game: mockGame, items: mockItems, repeatDays: 7 }
        }),
        useVisitsPostMutation: () => [mockPost, { isLoading: false }]
    },
    ApiModel: {},
    ApiType: {}
}))

jest.mock('@/hooks/usePreciseLocation', () => ({
    __esModule: true,
    default: () => ({ loading: false, request: mockPosition })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('next/link', () => {
    const Link = ({ href, children }: any) => <a href={href}>{children}</a>
    Link.displayName = 'Link'
    return Link
})

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled }: any) => (
        <button
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

jest.mock('@/components/shared', () => ({
    currentVisitOf: (data?: { items?: unknown[] }) => data?.items?.[0],
    GamePoints: ({ value, variant }: { value: number; variant?: string }) => (
        <span data-testid={`points-${variant ?? 'tint'}`}>{`+${value}`}</span>
    )
}))

const game: ApiType.Game.PlaceGame = {
    earned: null,
    photoBonus: 5,
    points: 30,
    position: 2,
    radius: 500,
    season: '2026-cold',
    way: null
}

const renderGame = () => {
    const store = configureStore({
        preloadedState: { auth: { isAuth: true, user: { id: 'u1' } } as never },
        reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
    })

    render(
        <Provider store={store}>
            <PlaceGame placeId={'p1'} />
        </Provider>
    )

    return store
}

describe('PlaceGame', () => {
    beforeEach(() => {
        mockPost.mockReset()
        mockPosition.mockReset()
        mockGame = game
        mockItems = []
    })

    it('renders nothing while the game is closed to the visitor or there is no season', () => {
        mockGame = undefined
        const { container, unmount } = render(
            <Provider
                store={configureStore({
                    preloadedState: { auth: { isAuth: true, user: { id: 'u1' } } as never },
                    reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
                })}
            >
                <PlaceGame placeId={'p1'} />
            </Provider>
        )

        expect(container).toBeEmptyDOMElement()
        unmount()

        mockGame = null
        renderGame()

        expect(screen.queryByText('game-place-offer')).not.toBeInTheDocument()
    })

    it('says what a check-in on the spot gives, and has no button of its own', () => {
        renderGame()

        expect(screen.getByTestId('points-tint')).toHaveTextContent('+30')
        expect(screen.getByText('game-place-offer')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('offers "Я сейчас здесь" for a visit of the week that is not counted: the position goes with the same check-in', async () => {
        mockItems = [{ id: 'v1', visitedAt: localPlainDate(0) }]
        mockPosition.mockResolvedValue({ accuracy: 12, lat: 51.75, lon: 55.1 })
        mockPost.mockReturnValue({
            unwrap: () => Promise.resolve({ game: { confirmed: true, points: 30 }, id: 'v1', isNew: false })
        })

        const store = renderGame()

        expect(screen.getByText('game-place-not-counted')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'game-place-here-now' }))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        // Asked for by name: a refusal is told, so the request is not a quiet one
        expect(mockPosition).toHaveBeenCalledWith()
        expect(mockPost).toHaveBeenCalledWith({
            accuracy: 12,
            lat: 51.75,
            lon: 55.1,
            place: 'p1',
            visitedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        })
        expect(store.getState().notification.list[0]).toMatchObject({
            message: 'game-place-confirmed: game-points-plus:30',
            type: 'success'
        })
    })

    it('tells how far the place is when "Я сейчас здесь" is pressed elsewhere', async () => {
        mockItems = [{ id: 'v1', visitedAt: localPlainDate(0) }]
        mockPosition.mockResolvedValue({ lat: 51.9, lon: 55.1 })
        mockPost.mockReturnValue({
            unwrap: () => Promise.resolve({ game: { confirmed: false, far: '2,4 км', points: 0 }, id: 'v1' })
        })

        const store = renderGame()

        fireEvent.click(screen.getByRole('button', { name: 'game-place-here-now' }))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(store.getState().notification.list[0]).toMatchObject({
            message: 'game-place-far:2,4 км',
            type: 'error'
        })
    })

    it('sends nothing when the browser gives no position', async () => {
        mockItems = [{ id: 'v1', visitedAt: localPlainDate(0) }]
        mockPosition.mockResolvedValue(undefined)
        renderGame()

        fireEvent.click(screen.getByRole('button', { name: 'game-place-here-now' }))

        await waitFor(() => expect(mockPosition).toHaveBeenCalled())
        expect(mockPost).not.toHaveBeenCalled()
    })

    it('shows the geopoints got once the place is counted — by a check-in or by a photo with no check-in', () => {
        mockGame = { ...game, earned: 30, way: 'geo' }
        const { unmount } = render(
            <Provider
                store={configureStore({
                    preloadedState: { auth: { isAuth: true, user: { id: 'u1' } } as never },
                    reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
                })}
            >
                <PlaceGame placeId={'p1'} />
            </Provider>
        )

        expect(screen.getByTestId('points-tint')).toHaveTextContent('+30')
        expect(screen.getByText('game-place-confirmed')).toBeInTheDocument()
        // A photo shot here would add its bonus
        expect(screen.getByText('game-place-photo-more:5')).toBeInTheDocument()
        unmount()

        // A photo counted the place: no visit of the visitor's own, nothing more to offer
        mockGame = { ...game, earned: 35, way: 'photo' }
        renderGame()

        expect(screen.getByTestId('points-tint')).toHaveTextContent('+35')
        expect(screen.queryByText(/game-place-photo-more/)).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
