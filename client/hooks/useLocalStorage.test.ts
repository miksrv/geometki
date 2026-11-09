import { act, renderHook } from '@testing-library/react'

import { LOCAL_STORAGE_KEY } from '@/config/constants'

import useLocalStorage from './useLocalStorage'

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('keeps the initial state when nothing is stored', () => {
        const { result } = renderHook(() => useLocalStorage('THEME', 'light'))

        expect(result.current[0]).toBe('light')
    })

    it('reads from localStorage after mount', () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ THEME: 'dark' }))
        const { result } = renderHook(() => useLocalStorage('THEME', 'light'))
        // After mount effect fires the value should reflect what's stored
        expect(result.current[0]).toBe('dark')
    })

    it('persists a new value to localStorage when state is updated', () => {
        const { result } = renderHook(() => useLocalStorage<string>('THEME', 'light'))
        act(() => {
            result.current[1]('dark')
        })
        const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
        expect(stored['THEME']).toBe('dark')
    })

    it('returns the setState function as the second element', () => {
        const { result } = renderHook(() => useLocalStorage('THEME'))
        expect(typeof result.current[1]).toBe('function')
    })
})
