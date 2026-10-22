import { makeStore } from '@/app/store'

import { hydrateAuthFromCookies, isAdminRequest } from './serverSideAuth'

jest.mock('cookies-next', () => ({
    getCookie: jest.fn(() => ''),
    setCookie: jest.fn(),
    deleteCookie: jest.fn()
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn(() => ''),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

describe('hydrateAuthFromCookies', () => {
    it('dispatches login when a token cookie is present', () => {
        const store = makeStore()
        hydrateAuthFromCookies(store, { token: 'my-token' })
        const auth = store.getState().auth
        expect(auth.token).toBe('my-token')
        expect(auth.isAuth).toBe(true)
    })

    it('dispatches login when only a session cookie is present', () => {
        const store = makeStore()
        hydrateAuthFromCookies(store, { session: 'my-session' })
        const auth = store.getState().auth
        expect(auth.session).toBe('my-session')
    })

    it('does not dispatch login when both token and session are absent', () => {
        const store = makeStore()
        const dispatchSpy = jest.spyOn(store, 'dispatch')
        hydrateAuthFromCookies(store, {})
        expect(dispatchSpy).not.toHaveBeenCalled()
    })

    it('sets isAuth to false when session is provided but no token', () => {
        const store = makeStore()
        hydrateAuthFromCookies(store, { session: 'sess-only' })
        const auth = store.getState().auth
        expect(auth.isAuth).toBe(false)
    })

    it('handles an empty cookies object gracefully', () => {
        const store = makeStore()
        expect(() => hydrateAuthFromCookies(store, {})).not.toThrow()
    })
})

describe('isAdminRequest', () => {
    it('does not ask auth/me without a token', async () => {
        const store = makeStore()
        const dispatch = jest.spyOn(store, 'dispatch')

        await expect(isAdminRequest(store)).resolves.toBe(false)
        expect(dispatch).not.toHaveBeenCalled()
    })

    it('does not ask auth/me with only a guest session', async () => {
        const store = makeStore()
        hydrateAuthFromCookies(store, { session: 'guest-session' })
        const dispatch = jest.spyOn(store, 'dispatch')

        await expect(isAdminRequest(store)).resolves.toBe(false)
        expect(dispatch).not.toHaveBeenCalled()
    })
})
