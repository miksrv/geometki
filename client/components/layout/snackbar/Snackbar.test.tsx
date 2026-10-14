import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen } from '@testing-library/react'

import { API } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { Snackbar } from './Snackbar'

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('cookies-next', () => ({
    getCookie: jest.fn().mockReturnValue(''),
    setCookie: jest.fn(),
    deleteCookie: jest.fn()
}))

const mockMarkRead = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useNotificationsGetUpdatesQuery: jest.fn().mockReturnValue({ data: undefined }),
        useNotificationsPatchReadMutation: jest.fn(() => [mockMarkRead])
    }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key })
}))

jest.mock('./Notification', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react')

    return {
        Notification: ({ id, message, onLoad }: any) => {
            useEffect(() => {
                onLoad?.(id)
            }, [])

            return <div data-testid={'snackbar-notification'}>{message}</div>
        }
    }
})

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: {
        RETURN_PATH: 'returnPath',
        LOCALE: 'locale',
        THEME: 'theme',
        LOCATION: 'location',
        MAP_CENTER: 'mapCenter'
    },
    AUTH_COOKIES: { SESSION: 'session', TOKEN: 'token' }
}))

const makeStore = (preloadedState?: Record<string, unknown>) =>
    configureStore({
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        },
        preloadedState
    })

const renderWithStore = (ui: React.ReactElement, preloadedState?: Record<string, unknown>) => {
    const store = makeStore(preloadedState)
    return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}

describe('Snackbar', () => {
    describe('rendering', () => {
        it('renders the snackbar container', () => {
            const { container } = renderWithStore(<Snackbar />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders nothing when there are no notifications', () => {
            renderWithStore(<Snackbar />)
            expect(screen.queryByTestId('snackbar-notification')).not.toBeInTheDocument()
        })

        it('renders notification items from store', () => {
            renderWithStore(<Snackbar />, {
                notification: {
                    list: [
                        { id: 'n1', type: 'success', message: 'First', read: false },
                        { id: 'n2', type: 'error', message: 'Second', read: true }
                    ]
                }
            })
            expect(screen.getAllByTestId('snackbar-notification')).toHaveLength(2)
        })
    })

    describe('server notifications', () => {
        beforeEach(() => {
            jest.useFakeTimers()
            jest.clearAllMocks()
        })

        afterEach(() => {
            jest.useRealTimers()
        })

        const mockUpdates = (ids: string[], fulfilledTimeStamp = 1) =>
            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({
                data: { count: 0, items: ids.map((id) => ({ id, message: id, type: 'comment' })) },
                fulfilledTimeStamp
            } as any)

        const rerenderWith = (rerender: (ui: React.ReactElement) => void, store: ReturnType<typeof makeStore>) =>
            rerender(
                <Provider store={store}>
                    <Snackbar />
                </Provider>
            )

        it('shows new server notifications as toasts and marks them read once they are on screen', async () => {
            mockMarkRead.mockReturnValue({ unwrap: () => Promise.resolve({ count: 0 }) })
            mockUpdates(['srv-1'])

            const { store, rerender } = renderWithStore(<Snackbar />, { auth: { isAuth: true } })

            expect(store.getState().notification.list.map(({ id }) => id)).toStrictEqual(['srv-1'])

            await act(async () => {
                jest.runOnlyPendingTimers()
            })
            expect(mockMarkRead).toHaveBeenCalledWith({ ids: ['srv-1'] })

            // The next poll returns the same notification: it is neither queued nor marked again
            mockUpdates(['srv-1'], 2)
            rerenderWith(rerender, store)

            await act(async () => {
                jest.runOnlyPendingTimers()
            })
            expect(store.getState().notification.list).toHaveLength(1)
            expect(mockMarkRead).toHaveBeenCalledTimes(1)
        })

        it('leaves the notifications queued behind the visible toasts unread', async () => {
            mockMarkRead.mockReturnValue({ unwrap: () => Promise.resolve({ count: 0 }) })
            mockUpdates(['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6'])

            const { store } = renderWithStore(<Snackbar />, { auth: { isAuth: true } })

            await act(async () => {
                jest.runOnlyPendingTimers()
            })

            expect(store.getState().notification.list).toHaveLength(6)
            expect(mockMarkRead).toHaveBeenCalledTimes(1)
            expect(mockMarkRead).toHaveBeenCalledWith({ ids: ['q-1', 'q-2', 'q-3', 'q-4'] })
        })

        it('retries a failed read mark with the next poll', async () => {
            mockMarkRead.mockReturnValueOnce({ unwrap: () => Promise.reject(new Error('503')) })
            mockMarkRead.mockReturnValue({ unwrap: () => Promise.resolve({ count: 0 }) })
            mockUpdates(['r-1'])

            const { store, rerender } = renderWithStore(<Snackbar />, { auth: { isAuth: true } })

            await act(async () => {
                jest.runOnlyPendingTimers()
            })
            expect(mockMarkRead).toHaveBeenCalledTimes(1)

            mockUpdates([], 2)
            await act(async () => {
                rerenderWith(rerender, store)
            })

            expect(mockMarkRead).toHaveBeenCalledTimes(2)
            expect(mockMarkRead).toHaveBeenLastCalledWith({ ids: ['r-1'] })
        })

        it('shows at most four toasts at once, the rest wait', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({ data: undefined } as any)

            renderWithStore(<Snackbar />, {
                notification: {
                    list: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, message: id, type: 'success' }))
                }
            })

            expect(screen.getAllByTestId('snackbar-notification')).toHaveLength(4)
            expect(screen.queryByText('e')).not.toBeInTheDocument()
        })

        it('is a polite live region', () => {
            renderWithStore(<Snackbar />)
            expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite')
        })
    })
})
