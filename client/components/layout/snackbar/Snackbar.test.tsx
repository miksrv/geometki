import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'

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

jest.mock('@/api', () => ({
    API: {
        useNotificationsGetUpdatesQuery: jest.fn().mockReturnValue({ data: undefined })
    }
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
    return render(<Provider store={store}>{ui}</Provider>)
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
                    counter: 0,
                    list: [
                        { id: 'n1', type: 'success', message: 'First', read: false },
                        { id: 'n2', type: 'error', message: 'Second', read: true }
                    ]
                }
            })
            expect(screen.getAllByTestId('snackbar-notification')).toHaveLength(2)
        })
    })
})
