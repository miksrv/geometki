import { act, renderHook } from '@testing-library/react'

import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

let popStateCallback: ((state: unknown) => boolean) | undefined

const mockPush = jest.fn(() => Promise.resolve(true))

// The hook wraps `push` on this instance, so tests navigate through `router.push`
const mockRouter = {
    beforePopState: (cb: (state: unknown) => boolean) => {
        popStateCallback = cb
    },
    push: mockPush,
    replace: jest.fn(() => Promise.resolve(true))
}

jest.mock('next/router', () => ({
    __esModule: true,
    default: {
        events: { on: jest.fn() },
        get router() {
            return mockRouter
        }
    }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

describe('useUnsavedChangesGuard', () => {
    it('lets navigation through while the form is clean', () => {
        const { unmount } = renderHook(() => useUnsavedChangesGuard(false))

        void mockRouter.push('/places')

        expect(mockPush).toHaveBeenCalledWith('/places', undefined, undefined)
        expect(popStateCallback?.({})).toBe(true)

        unmount()
    })

    it('holds a navigation behind the dialog when there are unsaved changes', async () => {
        mockPush.mockClear()
        const { result, unmount } = renderHook(() => useUnsavedChangesGuard(true))

        let navigated: boolean | undefined
        await act(async () => {
            navigated = await mockRouter.push('/places')
        })

        expect(navigated).toBe(false)
        expect(mockPush).not.toHaveBeenCalled()
        expect(result.current.dialogProps.open).toBe(true)
        expect(result.current.dialogProps.confirmLabel).toBe('leave-without-saving')

        act(() => result.current.dialogProps.onCancel())

        expect(result.current.dialogProps.open).toBe(false)
        expect(mockPush).not.toHaveBeenCalled()

        await act(async () => {
            await mockRouter.push('/places')
        })
        act(() => result.current.dialogProps.onConfirm())

        expect(mockPush).toHaveBeenCalledWith('/places', undefined, undefined)

        unmount()
    })

    it('lets shallow URL updates through', async () => {
        mockPush.mockClear()
        const { result, unmount } = renderHook(() => useUnsavedChangesGuard(true))

        await act(async () => {
            await mockRouter.push('/places?page=2', undefined, { shallow: true })
        })

        expect(mockPush).toHaveBeenCalled()
        expect(result.current.dialogProps.open).toBe(false)

        unmount()
    })

    it('blocks the browser Back button when there are unsaved changes', () => {
        const { result, unmount } = renderHook(() => useUnsavedChangesGuard(true))

        let allowed: boolean | undefined
        act(() => {
            allowed = popStateCallback?.({})
        })

        expect(allowed).toBe(false)
        expect(result.current.dialogProps.open).toBe(true)

        unmount()
    })

    it('asks before an in-page discard only when the form is dirty', () => {
        const discard = jest.fn()
        const { result, rerender, unmount } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
            initialProps: { dirty: false }
        })

        act(() => result.current.confirmDiscard(discard))
        expect(discard).toHaveBeenCalledTimes(1)

        rerender({ dirty: true })

        act(() => result.current.confirmDiscard(discard))
        expect(discard).toHaveBeenCalledTimes(1)
        expect(result.current.dialogProps.open).toBe(true)
        expect(result.current.dialogProps.confirmLabel).toBe('discard-changes')

        act(() => result.current.dialogProps.onConfirm())
        expect(discard).toHaveBeenCalledTimes(2)
        expect(result.current.dialogProps.open).toBe(false)

        unmount()
    })

    it('makes the browser prompt before closing the tab with unsaved changes', () => {
        const { unmount } = renderHook(() => useUnsavedChangesGuard(true))

        const event = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)

        unmount()
    })
})
