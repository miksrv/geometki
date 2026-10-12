import React from 'react'

import { renderHook } from '@testing-library/react'

import { makeTestStore, TestWrapper } from '@/__mocks__/commonMocks'

import useRequireAuth from './useRequireAuth'

const renderGuard = (isAuth: boolean) => {
    const store = makeTestStore({ auth: { isAuth, user: isAuth ? { id: 'u1', name: 'Alice' } : undefined } })
    const { result } = renderHook(() => useRequireAuth(), {
        wrapper: ({ children }: { children: React.ReactNode }) => <TestWrapper store={store}>{children}</TestWrapper>
    })

    return { guard: result.current, store }
}

const clickEvent = () => ({ preventDefault: jest.fn() }) as unknown as React.MouseEvent

describe('useRequireAuth', () => {
    it('lets a signed-in user go on', () => {
        const { guard, store } = renderGuard(true)
        const event = clickEvent()

        expect(guard(event)).toBe(true)
        expect(event.preventDefault).not.toHaveBeenCalled()
        expect(store.getState().application.showAuthDialog).toBe(false)
    })

    it('stops a guest and opens the auth dialog', () => {
        const { guard, store } = renderGuard(false)
        const event = clickEvent()

        expect(guard(event)).toBe(false)
        expect(event.preventDefault).toHaveBeenCalled()
        expect(store.getState().application.showAuthDialog).toBe(true)
    })

    it('works without an event', () => {
        const { guard, store } = renderGuard(false)

        expect(guard()).toBe(false)
        expect(store.getState().application.showAuthDialog).toBe(true)
    })
})
