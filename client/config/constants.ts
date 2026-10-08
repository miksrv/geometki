export const LOCAL_STORAGE_KEY = 'geometki'

// Level badge colors — 3 levels per group, 10 groups for levels 1-30
// Each entry: { fill: background color, border: darker outline color }
export const LEVEL_COLORS: Array<{ fill: string; border: string }> = [
    { fill: '#B0BEC5', border: '#546E7A' }, // 1–3   newcomer
    { fill: '#78909C', border: '#37474F' }, // 4–6   beginner
    { fill: '#26C6DA', border: '#00838F' }, // 7–9   active
    { fill: '#26A69A', border: '#00695C' }, // 10–12 explorer
    { fill: '#42A5F5', border: '#1565C0' }, // 13–15 experienced
    { fill: '#5C6BC0', border: '#283593' }, // 16–18 advanced
    { fill: '#7E57C2', border: '#4527A0' }, // 19–21 expert
    { fill: '#EF5350', border: '#B71C1C' }, // 22–24 master
    { fill: '#FF7043', border: '#BF360C' }, // 25–27 legend
    { fill: '#FFD700', border: '#B8860B' } // 28–30 grand legend
]

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
    MAP_SETTINGS: 'mapSettings',
    RETURN_PATH: 'returnPath',
    THEME: 'theme'
}

/** Place cover (the place page hero): 3:1, the smallest photo crop the API accepts as a cover, px */
export const PLACE_COVER_ASPECT = 3
export const PLACE_COVER_MIN_WIDTH = 1024
export const PLACE_COVER_MIN_HEIGHT = 341
