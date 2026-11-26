export const LOCAL_STORAGE_KEY = 'geometki'

// The tiers of the levels: three levels share a tier — a colour (`--color-level-<tier>` and its
// `-rim` and `-ink` in styles/theme.css) and a name (`levelTier.<tier>` in common.json)
export const LEVEL_TIERS = 10

// Request header the proxy sets to the request's locale: App Router pages (app/not-found.tsx)
// have no Pages Router i18n and read the locale from it
export const LOCALE_HEADER = 'x-locale'

// Cookie keys for authentication (accessible on both client and server)
export const AUTH_COOKIES = {
    SESSION: 'session',
    TOKEN: 'token'
} as const

// LocalStorage keys (client-side only)
export const LOCAL_STORAGE = {
    COOKIE_CONSENT: 'cookieConsent',
    LOCALE: 'locale',
    MAP_CENTER: 'mapCenter',
    MAP_SETTINGS: 'mapSettings',
    PUSH_PROMPT: 'pushPrompt',
    RETURN_PATH: 'returnPath',
    THEME: 'theme'
}

/** Place cover (the place page hero): 3:1, the smallest photo crop the API accepts as a cover, px */
export const PLACE_COVER_ASPECT = 3
export const PLACE_COVER_MIN_WIDTH = 400
export const PLACE_COVER_MIN_HEIGHT = 133

/**
 * Infinite lists request the next page while the end of the list is still this far below the
 * screen: new items are added out of view and do not push the footer down (CLS)
 */
export const INFINITE_SCROLL_ROOT_MARGIN = '0px 0px 1000px 0px'

/** The phone layout breakpoint, the same as `$mobileMaxWidth` in `styles/variables.sass` */
export const MOBILE_MAX_WIDTH = 768
