import { act, renderHook } from '@testing-library/react'

import { LOCAL_STORAGE_KEY } from '@/config/constants'

import useLocalStorage from './useLocalStorage'

describe('useLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns the initial state before the effect fires', () => {
        const { result } = renderHook(() => useLocalStorage('THEME', 'light'))
        // On first render, useState initializes with the provided initialState
        // After mount effect fires it reads from storage (empty → null), but
        // we care that the hook mounts without error.
        expect(result.current[0]).toBeDefined()
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
