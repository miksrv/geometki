import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import applicationReducer, { closeAuthDialog } from '@/app/applicationSlice'
import authReducer, { login } from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { checkInMessage, WasHereButton } from './WasHereButton'

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }))
jest.mock('../../../next-i18next.config', () => ({ i18n: { defaultLocale: 'ru' } }))
jest.mock('cookies-next', () => ({ deleteCookie: jest.fn(), getCookie: jest.fn(), setCookie: jest.fn() }))

const mockPost = jest.fn()
let mockMe: { count: number; items: Array<{ id: string; visitedAt: string }> } | undefined

jest.mock('@/api', () => ({
    API: {
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

    it('says so when the day already has a visit', async () => {
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v1', isNew: false, ordinal: 1 }) })
        const store = renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(store.getState().notification.list).toHaveLength(1))
        expect(store.getState().notification.list[0].message).toContain('Вы уже отмечались')
    })

    it('checks in again with a tap when there are visits', async () => {
        mockMe = { count: 2, items: [{ id: 'v1', visitedAt: '2026-10-01' }] }
        mockPost.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'v1', isNew: false, ordinal: 1 }) })
        renderButton(true)

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
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
        // Already today: the year line would be a lie
        expect(checkInMessage({ firstThisYear: true, isNew: false, ordinal: 1 }, t)).toStrictEqual({
            note: undefined,
            title: 'visit-already-today'
        })
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
