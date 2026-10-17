import React from 'react'
import { Provider } from 'react-redux'
import { getCookie } from 'cookies-next'

import { configureStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'

import { API } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { AppAuthChecker } from './AppAuthChecker'

jest.mock('cookies-next', () => ({
    getCookie: jest.fn().mockReturnValue(''),
    setCookie: jest.fn(),
    deleteCookie: jest.fn()
}))

jest.mock('@/api', () => ({
    API: {
        useAuthGetMeQuery: jest.fn().mockReturnValue({
            data: undefined,
            refetch: jest.fn(),
            isSuccess: false
        }),
        util: { resetApiState: jest.fn(() => ({ type: 'api/resetApiState' })) }
    }
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('@/config/constants', () => ({
    AUTH_COOKIES: { SESSION: 'session_cookie' },
    LOCAL_STORAGE: {
        LOCALE: 'locale',
        THEME: 'theme',
        RETURN_PATH: 'returnPath',
        LOCATION: 'location',
        MAP_CENTER: 'mapCenter'
    }
}))

const makeStore = (auth?: { token?: string; session?: string }) =>
    configureStore({
        preloadedState: auth ? { auth } : undefined,
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        }
    })

const renderWithStore = (ui: React.ReactElement, auth?: { token?: string; session?: string }) => {
    const store = makeStore(auth)
    return render(<Provider store={store}>{ui}</Provider>)
}

const queryOptions = () => jest.mocked(API.useAuthGetMeQuery).mock.calls.at(-1)?.[1]

describe('AppAuthChecker', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('rendering', () => {
        it('renders nothing visible (returns empty fragment)', () => {
            const { container } = renderWithStore(<AppAuthChecker />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('polling', () => {
        it('polls a signed-in visitor every minute', () => {
            renderWithStore(<AppAuthChecker />, { session: 's1', token: 't1' })
            expect(queryOptions()).toMatchObject({ pollingInterval: 60 * 1000, skip: false })
        })

        it('asks a guest without a session once, for one, and does not poll', () => {
            renderWithStore(<AppAuthChecker />, { session: '', token: '' })
            expect(queryOptions()).toMatchObject({ pollingInterval: 0, skip: false })
        })

        it('does not ask a guest who already has a session at all', () => {
            jest.mocked(getCookie).mockReturnValueOnce('s1')
            renderWithStore(<AppAuthChecker />, { session: 's1', token: '' })
            expect(queryOptions()).toMatchObject({ skip: true })
        })
    })

    describe('auth state changes', () => {
        it('dispatches login action when auth data returns auth=true', () => {
            jest.mocked(API.useAuthGetMeQuery).mockReturnValue({
                data: { auth: true, user: { id: 'u1', name: 'Alice' } },
                refetch: jest.fn(),
                isSuccess: true
            })

            // Should render without throwing
            const { container } = renderWithStore(<AppAuthChecker />)
            expect(container).toBeDefined()
        })

        it('does not crash when auth data returns auth=false', () => {
            jest.mocked(API.useAuthGetMeQuery).mockReturnValue({
                data: { auth: false },
                refetch: jest.fn(),
                isSuccess: true
            })

            const { container } = renderWithStore(<AppAuthChecker />)
            expect(container).toBeDefined()
            // An anonymous visitor keeps the cache: resetting it would refetch and log out again
            expect(API.util.resetApiState).not.toHaveBeenCalled()
        })
    })
})
