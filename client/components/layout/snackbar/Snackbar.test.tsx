import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'

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

jest.mock('./Notification', () => ({
    Notification: ({ message }: any) => <div data-testid={'snackbar-notification'}>{message}</div>
}))

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
            jest.clearAllMocks()
        })

        it('shows new server notifications as toasts and marks them read, once', () => {
            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({
                data: { count: 0, items: [{ id: 'srv-1', message: 'From server', type: 'comment' }] }
            } as any)

            const { store, rerender } = renderWithStore(<Snackbar />, { auth: { isAuth: true } })

            expect(store.getState().notification.list.map(({ id }) => id)).toStrictEqual(['srv-1'])
            expect(mockMarkRead).toHaveBeenCalledWith({ ids: ['srv-1'] })

            // The next poll returns the same notification before the read mark has landed

            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({
                data: { count: 0, items: [{ id: 'srv-1', message: 'From server', type: 'comment' }] }
            } as any)
            rerender(
                <Provider store={store}>
                    <Snackbar />
                </Provider>
            )

            expect(mockMarkRead).toHaveBeenCalledTimes(1)
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
