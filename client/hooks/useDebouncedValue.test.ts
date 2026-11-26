import { act, renderHook } from '@testing-library/react'

import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('keeps the old value until the pause', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
            initialProps: { value: 'a' }
        })

        rerender({ value: 'b' })
        expect(result.current).toBe('a')

        act(() => void jest.advanceTimersByTime(499))
        expect(result.current).toBe('a')

        act(() => void jest.advanceTimersByTime(1))
        expect(result.current).toBe('b')
    })
})
