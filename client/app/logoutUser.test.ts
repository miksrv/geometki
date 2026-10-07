import { configureStore } from '@reduxjs/toolkit'

import { API } from '@/api'

import authReducer from './authSlice'
import { logoutUser } from './logoutUser'

jest.mock('@/api', () => ({
    API: { util: { resetApiState: jest.fn(() => ({ type: 'api/resetApiState' })) } }
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    removeItem: jest.fn(),
    setItem: jest.fn()
}))

const makeStore = (isAuth?: boolean) =>
    configureStore({
        preloadedState: { auth: { isAuth } },
        reducer: { auth: authReducer }
    })

describe('logoutUser', () => {
    beforeEach(() => jest.clearAllMocks())

    it('logs a signed-in user out and drops the cached API responses', () => {
        const store = makeStore(true)

        store.dispatch(logoutUser() as never)

        expect(store.getState().auth.isAuth).toBe(false)
        expect(API.util.resetApiState).toHaveBeenCalledTimes(1)
    })

    it('keeps the cache for an anonymous visitor (no refetch-and-logout loop)', () => {
        const store = makeStore(undefined)

        store.dispatch(logoutUser() as never)

        expect(store.getState().auth.isAuth).toBe(false)
        expect(API.util.resetApiState).not.toHaveBeenCalled()
    })
})
