import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import applicationReducer, { closeAuthDialog } from '@/app/applicationSlice'
import authReducer, { login } from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'
import { localPlainDate } from '@/utils/date'

import { checkInMessage, WasHereButton } from './WasHereButton'

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }))
jest.mock('../../../next-i18next.config', () => ({ i18n: { defaultLocale: 'ru' } }))
jest.mock('cookies-next', () => ({ deleteCookie: jest.fn(), getCookie: jest.fn(), setCookie: jest.fn() }))

const mockPost = jest.fn()
const mockDelete = jest.fn()
const mockPosition = jest.fn()
let mockMe:
    | {
          count: number
          items: Array<{ id: string; visitedAt: string; confirmed?: string }>
          repeatDays?: number
          game?: { earned: number | null; points: number }
      }
    | undefined

jest.mock('@/hooks/usePreciseLocation', () => ({
    __esModule: true,
    default: () => ({ loading: false, request: mockPosition })
}))

// Opened by a state change only: no need for the kit's dialog here
jest.mock('next/dynamic', () => () => {
    const Dialog = ({ message, confirmLabel, onConfirm }: any) => (
        <div role={'dialog'}>
            {message}
            <button onClick={onConfirm}>{confirmLabel}</button>
        </div>
    )
    Dialog.displayName = 'ConfirmationDialog'
    return Dialog
})

jest.mock('@/api', () => ({
    API: {
        useVisitsDeleteMutation: () => [mockDelete, { isLoading: false }],
        useVisitsGetMeQuery: () => ({ data: mockMe }),
        useVisitsPostMutation: () => [mockPost, { isLoading: false }]
    },
    ApiModel: {},
    ApiType: {}
}))

const renderButton = (isAuth: boolean, copies = 1) => {
    const store = configureStore({
        preloadedState: { auth: { isAuth, user: isAuth ? { id: 'u1' } : undefined } as never },
        reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
    })

    render(
        <Provider store={store}>
            {Array.from({ length: copies }, (_, index) => (
                <WasHereButton
                    key={index}
                    placeId={'p1'}
                />
            ))}
        </Provider>
    )

    return store
}

describe('WasHereButton', () => {
    beforeEach(() => {
        mockPost.mockReset()
        mockDelete.mockReset()
        mockPosition.mockReset()
        mockMe = undefined
        localStorage.clear()
        sessionStorage.clear()
    })

    const signIn = (store: ReturnType<typeof renderButton>) =>
        act(() => {
            store.dispatch(login({ auth: true, token: 't', user: { id: 'u1' } } as never))
            store.dispatch(closeAuthDialog())
        })

    const visit = { firstThisYear: false, isNew: true, ordinal: 1 }

    it("checks a guest in right after the sign-in, the tap's place only", async () => {
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve(visit) })
        const store = renderButton(false, 2)

        fireEvent.click(screen.getAllByRole('button')[0])
        signIn(store)

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
        expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ place: 'p1' }))
        expect(sessionStorage.getItem('visit_sign_in_intent')).toBeNull()
    })

    it('drops the tap when the sign-in dialog is closed without signing in', () => {
        const store = renderButton(false)

        fireEvent.click(screen.getByRole('button'))
        act(() => {
            store.dispatch(closeAuthDialog())
        })
        signIn(store)

        expect(mockPost).not.toHaveBeenCalled()
    })

    it('checks in after a sign-in that reloaded the page', async () => {
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve(visit) })
        sessionStorage.setItem('visit_sign_in_intent', JSON.stringify({ placeId: 'p1', timestamp: Date.now() }))

        renderButton(true, 2)

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    })

    it('forgets a tap older than ten minutes', () => {
        sessionStorage.setItem(
            'visit_sign_in_intent',
            JSON.stringify({ placeId: 'p1', timestamp: Date.now() - 11 * 60000 })
        )

        renderButton(true)

        expect(mockPost).not.toHaveBeenCalled()
        expect(sessionStorage.getItem('visit_sign_in_intent')).toBeNull()
    })

    it('opens the sign-in dialog for a guest and makes no visit', () => {
        const store = renderButton(false)

        fireEvent.click(screen.getByRole('button'))

        expect(store.getState().application.showAuthDialog).toBe(true)
        expect(mockPost).not.toHaveBeenCalled()
    })

    it('checks in with the local day and tells the number of the visit', async () => {
        mockPost.mockReturnValue({
            unwrap: () => Promise.resolve({ firstThisYear: true, id: 'v1', isNew: true, ordinal: 3 })
        })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(mockPost).toHaveBeenCalledWith({ place: 'p1', visitedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
        expect(store.getState().notification.list[0]).toMatchObject({
            id: 'visited',
            message: expect.stringContaining('Визит №'),
            type: 'success'
        })
    })

    it('says so when the week already has a visit', async () => {
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v1', isNew: false, ordinal: 1 }) })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(store.getState().notification.list[0].message).toContain('Вы уже отмечались')
    })

    it('checks in again with a tap a week after the last visit', async () => {
        mockMe = { count: 2, items: [{ id: 'v1', visitedAt: localPlainDate(-7) }], repeatDays: 7 }
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v2', isNew: true, ordinal: 3 }) })
        renderButton(true)

        expect(screen.getByRole('button')).toHaveTextContent('Вы были здесь')

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('cancels the visit of this week with a tap', async () => {
        mockMe = {
            count: 2,
            items: [
                { id: 'v0', visitedAt: '2026-01-10' },
                { id: 'v1', visitedAt: localPlainDate(-6) }
            ],
            repeatDays: 7
        }
        mockDelete.mockReturnValue({ unwrap: () => Promise.resolve() })
        const store = renderButton(true)

        expect(screen.getByRole('button')).toHaveTextContent('Вы здесь отметились')

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(mockDelete).toHaveBeenCalledWith({ id: 'v1', place: 'p1' })
        expect(mockPost).not.toHaveBeenCalled()
        expect(store.getState().notification.list[0].message).toBe('Визит отменён')
    })

    it('without a season asks for the position too: on the spot the visit is confirmed, without geopoints', async () => {
        mockPosition.mockResolvedValue({ accuracy: 10, lat: 51.77, lon: 55.1 })
        mockPost
            .mockReturnValueOnce({ unwrap: () => Promise.resolve({ id: 'v1', isNew: true, ordinal: 1 }) })
            .mockReturnValueOnce({
                unwrap: () =>
                    Promise.resolve({ game: { confirmed: true, points: 0 }, id: 'v1', isNew: false, ordinal: 1 })
            })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
        expect(mockPosition).toHaveBeenCalledWith({ quiet: true })
        expect(mockPost).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 51.77, lon: 55.1, place: 'p1' }))
        await waitFor(() =>
            expect(store.getState().notification.list.map((item) => item.message)).toStrictEqual([
                'Визит №{{count}} в это место. visit-confirmed'
            ])
        )
    })

    it('in the game checks in at once and does not wait for the position: it comes later and counts the visit', async () => {
        mockMe = { count: 0, game: { earned: null, points: 30 }, items: [] }

        let found: (position: unknown) => void = () => undefined
        mockPosition.mockReturnValue(new Promise((resolve) => (found = resolve)))
        mockPost
            .mockReturnValueOnce({
                unwrap: () =>
                    Promise.resolve({ game: { confirmed: false, points: 0 }, id: 'v1', isNew: true, ordinal: 1 })
            })
            .mockReturnValueOnce({
                unwrap: () =>
                    Promise.resolve({ game: { confirmed: true, points: 30 }, id: 'v1', isNew: false, ordinal: 1 })
            })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        // The visit is made (and its questions asked) while the browser still looks for the position
        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(mockPosition).toHaveBeenCalledWith({ quiet: true })
        expect(mockPost).toHaveBeenCalledTimes(1)
        expect(mockPost).toHaveBeenCalledWith({ place: 'p1', visitedAt: expect.any(String) })

        await act(async () => found({ accuracy: 12, lat: 51.75, lon: 55.1 }))

        // One tap, one toast: the confirmation extends the check-in's line
        await waitFor(() => expect(store.getState().notification.list[0].message).toContain('game-points-plus'))
        expect(store.getState().notification.list).toHaveLength(1)
        expect(mockPost).toHaveBeenLastCalledWith({
            accuracy: 12,
            lat: 51.75,
            lon: 55.1,
            place: 'p1',
            visitedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        })
        expect(store.getState().notification.list[0].message).toMatch(/^Визит.*game-place-confirmed: game-points-plus$/)
    })

    it('in the game is a plain visit without a position: no error', async () => {
        mockMe = { count: 0, game: { earned: null, points: 30 }, items: [] }
        mockPosition.mockResolvedValue(undefined)
        mockPost.mockReturnValue({
            unwrap: () => Promise.resolve({ game: { confirmed: false, points: 0 }, id: 'v1', isNew: true, ordinal: 1 })
        })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(mockPost).toHaveBeenCalledTimes(1)
        expect(mockPost).toHaveBeenCalledTimes(1)
        expect(mockPost).toHaveBeenCalledWith({ place: 'p1', visitedAt: expect.any(String) })
        expect(store.getState().notification.list[0]).toMatchObject({ type: 'success' })
        expect(store.getState().notification.list[0].message).not.toContain('game-points-plus')
    })

    it('asks before cancelling a visit that brought geopoints', async () => {
        mockMe = {
            count: 1,
            game: { earned: 30, points: 30 },
            items: [{ confirmed: 'geo', id: 'v1', visitedAt: localPlainDate(0) }],
            repeatDays: 7
        }
        mockDelete.mockReturnValue({ unwrap: () => Promise.resolve() })
        renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        expect(mockDelete).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog')).toHaveTextContent('visit-cancel-game-confirm')

        fireEvent.click(screen.getByRole('button', { name: 'visit-cancel-game-button' }))

        await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'v1', place: 'p1' }))
    })

    it('sends one request when the place has two buttons tapped in a row', async () => {
        let resolve: (value: unknown) => void = () => undefined
        mockPost.mockReturnValue({ unwrap: () => new Promise((done) => (resolve = done)) })
        renderButton(true, 2)

        const [first, second] = screen.getAllByRole('button')

        fireEvent.click(first)
        fireEvent.click(second)

        expect(mockPost).toHaveBeenCalledTimes(1)

        resolve({ id: 'v1', isNew: true, ordinal: 1 })
        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    })

    it('hands the check-in to the parent instead of the toast: the phone bar opens the questions with it', async () => {
        const onCheckedIn = jest.fn()
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v1', isNew: false, ordinal: 1 }) })
        const store = configureStore({
            preloadedState: { auth: { isAuth: true, user: { id: 'u1' } } as never },
            reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
        })

        render(
            <Provider store={store}>
                <WasHereButton
                    placeId={'p1'}
                    onCheckedIn={onCheckedIn}
                />
            </Provider>
        )

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(onCheckedIn).toHaveBeenCalledWith({ id: 'v1', isNew: false, ordinal: 1 }))
        expect(store.getState().notification.list).toHaveLength(0)
    })

    it('words a check-in: the number of the visit and the first of the year as a second line', () => {
        const t = (key: string, options?: Record<string, unknown>) =>
            `${key}${options?.count ? `:${String(options.count)}` : ''}`

        expect(checkInMessage({ firstThisYear: true, isNew: true, ordinal: 3 }, t)).toStrictEqual({
            note: 'visit-result-first-this-year',
            title: 'visit-result-title:3'
        })
        expect(checkInMessage({ firstThisYear: false, isNew: true, ordinal: 3 }, t)).toStrictEqual({
            note: undefined,
            title: 'visit-result-title:3'
        })
        // Already this week: the year line would be a lie
        expect(checkInMessage({ firstThisYear: true, isNew: false, ordinal: 1 }, t)).toStrictEqual({
            note: undefined,
            title: 'visit-already-this-week'
        })
        // The game: a check-in on the spot tells the geopoints; the visit of the week it counted says so
        expect(
            checkInMessage({ firstThisYear: false, game: { confirmed: true, points: 30 }, isNew: true, ordinal: 3 }, t)
        ).toStrictEqual({ note: 'game-points-plus:30', title: 'visit-result-title:3' })
        expect(
            checkInMessage({ firstThisYear: false, game: { confirmed: true, points: 30 }, isNew: false, ordinal: 1 }, t)
        ).toStrictEqual({ note: 'game-points-plus:30', title: 'game-place-confirmed' })
    })

    it('has no pressed state: it is an action, not a toggle', () => {
        mockMe = { count: 2, items: [] }
        renderButton(true)

        expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed')
    })

    it('sends the visits saved offline by this user on the mount and drops the foreign ones', async () => {
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v1', isNew: true, ordinal: 1 }) })
        const now = Date.now()

        localStorage.setItem(
            'pending_visits',
            JSON.stringify([
                { placeId: 'p7', timestamp: now, userId: 'u1', visitedAt: '2026-10-25' },
                { placeId: 'p8', timestamp: now, userId: 'u2', visitedAt: '2026-10-25' },
                { placeId: 'p9', timestamp: now, visitedAt: '2026-10-25' }
            ])
        )
        renderButton(true)

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
        expect(mockPost).toHaveBeenCalledWith({ place: 'p7', visitedAt: '2026-10-25' })
        expect(JSON.parse(localStorage.getItem('pending_visits') ?? '[]')).toEqual([])
    })

    it('keeps the queue of a guest untouched', () => {
        localStorage.setItem(
            'pending_visits',
            JSON.stringify([{ placeId: 'p7', timestamp: Date.now(), userId: 'u1', visitedAt: '2026-10-25' }])
        )
        renderButton(false)

        expect(mockPost).not.toHaveBeenCalled()
        expect(JSON.parse(localStorage.getItem('pending_visits') ?? '[]')).toHaveLength(1)
    })
})
