import { ApiModel } from '@/api'

import authReducer, { login, logout, saveSession } from './authSlice'

jest.mock('cookies-next', () => ({
    deleteCookie: jest.fn(),
    setCookie: jest.fn()
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn(() => ''),
    removeItem: jest.fn(),
    setItem: jest.fn()
}))

const mockUser: ApiModel.User = { id: '1', name: 'Alice' }

describe('authSlice', () => {
    const initialState = {
        isAuth: undefined,
        session: '',
        token: '',
        user: undefined
    }

    describe('initial state', () => {
        it('has the correct initial shape', () => {
            const state = authReducer(undefined, { type: '@@INIT' })

            expect(state.isAuth).toBeUndefined()
            expect(state.token).toBeDefined()
            expect(state.session).toBeDefined()
        })
    })

    describe('login', () => {
        it('sets auth state when payload has auth=true', () => {
            const payload = {
                auth: true,
                session: 'sess-123',
                token: 'tok-abc',
                user: mockUser
            }

            const state = authReducer({ ...initialState }, login(payload))

            expect(state.isAuth).toBe(true)
            expect(state.token).toBe('tok-abc')
            expect(state.session).toBe('sess-123')
            expect(state.user).toStrictEqual(mockUser)
        })

        it('clears auth state when payload has auth=false', () => {
            const existingState = {
                isAuth: true,
                session: 'old-sess',
                token: 'old-tok',
                user: mockUser
            }

            const state = authReducer(existingState, login({ auth: false, token: '', session: '' }))

            expect(state.isAuth).toBe(false)
            expect(state.token).toBe('')
            expect(state.session).toBe('')
            expect(state.user).toBeUndefined()
        })

        it('handles undefined payload gracefully', () => {
            const state = authReducer({ ...initialState }, login(undefined))

            expect(state.isAuth).toBe(false)
            expect(state.token).toBe('')
            expect(state.session).toBe('')
            expect(state.user).toBeUndefined()
        })
    })

    describe('logout', () => {
        it('clears token, user and sets isAuth to false', () => {
            const existingState = {
                isAuth: true,
                session: 'sess-123',
                token: 'tok-abc',
                user: mockUser
            }

            const state = authReducer(existingState, logout())

            expect(state.isAuth).toBe(false)
            expect(state.token).toBeUndefined()
            expect(state.user).toBeUndefined()
            // session is not cleared by logout
            expect(state.session).toBe('sess-123')
        })
    })

    describe('saveSession', () => {
        it('stores the session string in state', () => {
            const state = authReducer({ ...initialState }, saveSession('new-session-value'))

            expect(state.session).toBe('new-session-value')
        })
    })
})
