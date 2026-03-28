import { renderHook } from '@testing-library/react'

import useClientOnly from './useClientOnly'

describe('useClientOnly', () => {
    it('returns true after mounting (client-side effect fires in jsdom)', () => {
        // In jsdom with @testing-library/react, useEffect runs synchronously after render,
        // so the hook immediately reports isClient = true after the first render.
        const { result } = renderHook(() => useClientOnly())
        expect(result.current).toBe(true)
    })

    it('returns a boolean value', () => {
        const { result } = renderHook(() => useClientOnly())
        expect(typeof result.current).toBe('boolean')
    })
})
