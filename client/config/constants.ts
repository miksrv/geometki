export const LOCAL_STORAGE_KEY = 'geometki'

// Cookie keys for authentication (accessible on both client and server)
export const AUTH_COOKIES = {
    SESSION: 'session',
    TOKEN: 'token'
} as const

// LocalStorage keys (client-side only)
export const LOCAL_STORAGE = {
    LOCALE: 'locale',
    LOCATION: 'location',
    MAP_CENTER: 'mapCenter',
    RETURN_PATH: 'returnPath',
    THEME: 'theme'
}
