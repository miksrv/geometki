/** The prefix of the pages rendered on the request for the visitors the page cache does not fit (proxy.ts) */
export const LIVE_PREFIX = '/live'

/**
 * The route as the visitor sees it: `pages/live/places/[id]` (a signed-in user's place page,
 * proxy.ts → `CACHED_PAGES`) is the place page `/places/[id]`, `pages/live` the home page. What
 * the navigation marks as active is read from this, never from the raw `router.pathname`.
 */
export const sitePathname = (pathname: string): string =>
    pathname === LIVE_PREFIX
        ? '/'
        : pathname.startsWith(`${LIVE_PREFIX}/`)
          ? pathname.slice(LIVE_PREFIX.length)
          : pathname
