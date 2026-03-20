import type { Locale } from '@/api/types'

import applicationReducer, {
    closeAuthDialog,
    openAuthDialog,
    setLocale,
    setUserLocation,
    toggleOverlay
} from './applicationSlice'

jest.mock('cookies-next', () => ({
    setCookie: jest.fn()
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn(() => undefined),
    removeItem: jest.fn(),
    setItem: jest.fn()
}))

jest.mock('../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

describe('applicationSlice', () => {
    const initialState = {
        locale: 'ru' as Locale,
        showAuthDialog: false,
        showOverlay: false,
        userLocation: undefined
    }

    describe('initial state', () => {
        it('has the correct initial shape', () => {
            const state = applicationReducer(undefined, { type: '@@INIT' })

            expect(state.showAuthDialog).toBe(false)
            expect(state.showOverlay).toBe(false)
            expect(state.userLocation).toBeUndefined()
        })
    })

    describe('openAuthDialog', () => {
        it('sets showAuthDialog and showOverlay to true', () => {
            const state = applicationReducer({ ...initialState }, openAuthDialog())

            expect(state.showAuthDialog).toBe(true)
            expect(state.showOverlay).toBe(true)
        })
    })

    describe('closeAuthDialog', () => {
        it('sets showAuthDialog and showOverlay to false', () => {
            const openState = { ...initialState, showAuthDialog: true as boolean, showOverlay: true as boolean }
            const state = applicationReducer(openState, closeAuthDialog())

            expect(state.showAuthDialog).toBe(false)
            expect(state.showOverlay).toBe(false)
        })
    })

    describe('toggleOverlay', () => {
        it('sets showOverlay to true when payload is true', () => {
            const state = applicationReducer({ ...initialState }, toggleOverlay(true))

            expect(state.showOverlay).toBe(true)
        })

        it('sets showOverlay to false when payload is false', () => {
            const state = applicationReducer({ ...initialState, showOverlay: true }, toggleOverlay(false))

            expect(state.showOverlay).toBe(false)
        })
    })

    describe('setLocale', () => {
        it('updates locale to en', () => {
            const state = applicationReducer({ ...initialState }, setLocale('en'))

            expect(state.locale).toBe('en')
        })

        it('updates locale to ru', () => {
            const state = applicationReducer({ ...initialState, locale: 'en' }, setLocale('ru'))

            expect(state.locale).toBe('ru')
        })
    })

    describe('setUserLocation', () => {
        it('sets userLocation in state', () => {
            const coords = { lat: 55.75, lon: 37.61 }
            const state = applicationReducer({ ...initialState }, setUserLocation(coords))

            expect(state.userLocation).toStrictEqual(coords)
        })
    })
})
