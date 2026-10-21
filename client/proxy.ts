import type { NextRequest } from 'next/server'
// Two lint rules disagree on this one: `import/consistent-type-specifier-style` wants the
// type import split out of the value import above, `no-duplicate-imports` then flags the
// split as a duplicate source — there is no form that satisfies both.
// eslint-disable-next-line no-duplicate-imports
import { NextResponse } from 'next/server'

import { AUTH_COOKIES, LOCALE_HEADER } from '@/config/constants'
import { isCategoryCombination, isCrawler, isGeoList } from '@/utils/crawler'
import { getLandingFlags, isLandingSegment, LANDING_PROXY_HEADER } from '@/utils/placesLanding'
import { SITE_TIME_ZONE, TIME_ZONE_COOKIE } from '@/utils/timeZone'
import { USER_LOCATION_COOKIE } from '@/utils/userLocation'

// A per-server-instance secret, generated once when this module is first loaded and never
// sent to any client. `x-landing-proxied` only carries real meaning when its value is this
// exact string — set a few lines below, the one place in this file that is allowed to set
// it. A client cannot guess it, so it cannot spoof its way past the direct-access guard
// below by simply sending the header name (review finding, 2026-10-09: a request with
// `x-landing-proxied: 1` reached `/places/landing/...` directly and rendered 200 there,
// because the previous version only checked whether the header was *present*).
const PROXY_SECRET = crypto.randomUUID()

// Matches `/places/{x}` or `/places/{x}/{y}` (no trailing slash variant: trailingSlash is
// false in next.config, so Next already normalizes that before the proxy sees it). The
// direct-access guard below already turns away every request under `/places/landing`, so in
// practice this regex never sees one — the negative lookahead is kept anyway as a second,
// independent line of defence against the same nested-rewrite bug the guard exists to avoid
// (`/places/landing/landing/cave`, see that guard's comment).
const PLACES_LANDING_PATH = /^\/places\/(?!landing(?:\/|$))([^/]+)(?:\/([^/]+))?$/

/**
 * Pages served from the Next cache (getStaticProps): one render for every guest and crawler —
 * 99% of the visits. A visitor the cached render does not fit gets the same page rendered on
 * the request (`pages/live/...`, getServerSideProps): a signed-in user always (fresh, with their
 * own marks), a guest when a cookie or the query changes what the page shows. The URL in the
 * browser is untouched.
 */
interface CachedPage {
    path: RegExp
    /** The per-request copy: `$1` is the path's first group */
    live: string
    /** The guest's point (the `location` cookie) shows as distances on the page */
    location?: boolean
    /** The page has days (feed headings, the calendar): a visitor outside the site's zone */
    timeZone?: boolean
    /** Query parameters the page reads (getStaticProps never sees the query) */
    query?: string[]
}

const CACHED_PAGES: CachedPage[] = [
    { live: '/live', location: true, path: /^\/$/ },
    // A place: the 13-character hex id, alone or with its slug (utils/place.ts)
    { live: '/live/places/$1', path: /^\/places\/([0-9a-f]{13}(?:-[^/]*)?)$/ },
    { live: '/live/collections/$1', path: /^\/collections\/([^/]+)$/ },
    // Not /users/settings: a page of its own
    { live: '/live/users/$1', path: /^\/users\/(?!settings$)([^/]+)$/, timeZone: true },
    { live: '/live/activity', path: /^\/activity$/, query: ['type'], timeZone: true }
]

/** The per-request copy of a cached page, when this request needs it */
const livePath = (request: NextRequest, signedIn: boolean): string | undefined => {
    const { pathname, searchParams } = request.nextUrl

    for (const page of CACHED_PAGES) {
        const match = pathname.match(page.path)

        if (!match) {
            continue
        }

        const timeZone = request.cookies.get(TIME_ZONE_COOKIE)?.value
        const personal =
            signedIn ||
            (page.location && !!request.cookies.get(USER_LOCATION_COOKIE)?.value) ||
            (page.timeZone && !!timeZone && timeZone !== SITE_TIME_ZONE) ||
            page.query?.some((name) => searchParams.has(name))

        return personal ? page.live.replace('$1', match[1] ?? '') : undefined
    }

    return undefined
}

export const proxy = (request: NextRequest) => {
    // Never trust a client-supplied copy of this header, on any path — only this file's own
    // rewrite below (further down) is allowed to set it, and only to `PROXY_SECRET`. Every
    // response that lets a request continue forwards this sanitized copy instead of the raw
    // incoming headers.
    const sanitizedHeaders = new Headers(request.headers)
    sanitizedHeaders.delete(LANDING_PROXY_HEADER)
    // The 404 page is an App Router page (app/not-found.tsx) and knows nothing of the /en prefix
    sanitizedHeaders.set(LOCALE_HEADER, request.nextUrl.locale)

    // Crawlers walking every combination of the category chips (`/places?category=a,b,c&sort=…`)
    // made the API host run out of CPU: each such page costs several API requests and is
    // `noindex` anyway, so they get a 410 without rendering it. The same for the lists sorted by
    // distance from a point (`/places?lat=…&lon=…`), one per place × category × page.
    // People keep the combinations.
    if (
        request.nextUrl.pathname.startsWith('/places') &&
        (isCategoryCombination(request.nextUrl.searchParams) || isGeoList(request.nextUrl.searchParams)) &&
        isCrawler(request.headers.get('user-agent'))
    ) {
        return new NextResponse(null, { headers: { 'X-Robots-Tag': 'noindex' }, status: 410 })
    }

    // TEMPORARILY (1.17.5): lists sorted by distance from a point in the URL (`/places?lat=…&lon=…`),
    // one per place × category × page, were a third of the API load: scrapers posing as browsers
    // kept walking them. The site no longer links to them, so everybody else (a crawler got its 410
    // above, without a render) is sent to the list without the query; the distance from the
    // visitor comes from the `location` cookie instead
    if (request.nextUrl.pathname.startsWith('/places') && isGeoList(request.nextUrl.searchParams)) {
        const url = request.nextUrl.clone()
        url.search = ''
        return Response.redirect(url.toString(), 301)
    }

    // TEMPORARILY (1.17.6): the tags are being reworked, so the lists of a tag (`/places?tag=…`,
    // one per tag × category × page) are not served and the site no longer links to them: everybody,
    // crawlers too, is sent to the same list without the tag, so search engines drop those pages.
    // Not stored by browsers: a 301 is kept for good otherwise, and the lists come back with the tags
    if (request.nextUrl.pathname.startsWith('/places') && request.nextUrl.searchParams.has('tag')) {
        const url = request.nextUrl.clone()
        url.searchParams.delete('tag')
        return new Response(null, {
            headers: { 'Cache-Control': 'no-store', Location: url.toString() },
            status: 301
        })
    }

    // Direct access to the internal landing route (features/20-location-seo-pages.md):
    // handled first, before any other rule below reads the path, so nothing can ever serve
    // content at `/places/landing/...` (or `/en/places/landing/...` — nextUrl.pathname has
    // the locale prefix already stripped) itself; only this proxy's own rewrite, which alone
    // knows `PROXY_SECRET`, may continue past this point with that exact pathname.
    if (request.nextUrl.pathname === '/places/landing' || request.nextUrl.pathname.startsWith('/places/landing/')) {
        if (request.headers.get(LANDING_PROXY_HEADER) === PROXY_SECRET) {
            return NextResponse.next({ request: { headers: sanitizedHeaders } })
        }

        const url = request.nextUrl.clone()
        url.pathname = url.pathname.replace(/^\/places\/landing(?=\/|$)/, '/places')
        return Response.redirect(url.toString(), 301)
    }

    // The per-request copies of the cached pages are reached only by the rewrite below
    if (request.nextUrl.pathname === '/live' || request.nextUrl.pathname.startsWith('/live/')) {
        const url = request.nextUrl.clone()
        url.pathname = url.pathname.replace(/^\/live(?=\/|$)/, '') || '/'
        return Response.redirect(url.toString(), 301)
    }

    const currentUser = request.cookies.get(AUTH_COOKIES.TOKEN)?.value
    const live = livePath(request, !!currentUser)

    if (live) {
        const url = request.nextUrl.clone()
        url.pathname = live
        return NextResponse.rewrite(url, { request: { headers: sanitizedHeaders } })
    }

    if (!currentUser && request.nextUrl.pathname.startsWith('/places/create')) {
        return Response.redirect(new URL('/places', request.url))
    }

    // The edit link is a real link (it can be opened in a new tab), so guests are sent back to the place.
    // nextUrl.pathname comes without the locale prefix; the clone keeps the locale (/en) in the redirect.
    if (!currentUser && /^\/places\/[^/]+\/edit\/?$/.test(request.nextUrl.pathname)) {
        const placeUrl = request.nextUrl.clone()
        placeUrl.pathname = placeUrl.pathname.replace(/\/edit\/?$/, '')

        return Response.redirect(placeUrl.toString())
    }

    if (!currentUser && request.nextUrl.pathname.startsWith('/users/settings')) {
        return Response.redirect(new URL('/users', request.url))
    }

    if (!currentUser && request.nextUrl.pathname.startsWith('/admin')) {
        return Response.redirect(new URL('/', request.url))
    }

    if (currentUser && request.nextUrl.pathname.startsWith('/auth')) {
        return Response.redirect(new URL('/', request.url))
    }

    // Flat landing URLs (features/20-location-seo-pages.md): `/places/{category}`,
    // `/places/{location}` and `/places/{location}/{category}` are internally rewritten to
    // the one listing page (`pages/places/landing/[...slug].tsx`), never to
    // `pages/places/[id]/index.tsx` — Next.js would otherwise prioritise that single-segment
    // dynamic route over this one, since it is more specific than a catch-all. The URL in the
    // browser is untouched. Flag off ⇒ no rewrite ⇒ exactly today's behaviour (a non-id
    // segment falls through to the place page, which 404s on it, same as before this feature).
    const landingMatch = request.nextUrl.pathname.match(PLACES_LANDING_PATH)

    if (landingMatch) {
        const [, first, second] = landingMatch
        const flags = getLandingFlags()

        const proxiedHeaders = new Headers(sanitizedHeaders)
        proxiedHeaders.set(LANDING_PROXY_HEADER, PROXY_SECRET)
        const rewriteInit = { request: { headers: proxiedHeaders } }

        if (second === undefined) {
            if ((flags.categories || flags.locations) && isLandingSegment(first)) {
                const url = request.nextUrl.clone()
                url.pathname = `/places/landing/${first}`
                return NextResponse.rewrite(url, rewriteInit)
            }
        } else if (flags.combinations && isLandingSegment(first) && isLandingSegment(second)) {
            const url = request.nextUrl.clone()
            url.pathname = `/places/landing/${first}/${second}`
            return NextResponse.rewrite(url, rewriteInit)
        }
    }

    return NextResponse.next({ request: { headers: sanitizedHeaders } })
}

// Static files from /public the proxy has nothing to do with: images, the PWA manifests, the
// service worker and its offline page. The root is listed apart: with the locales the pattern
// below needs a segment after `/ru`, so the home page alone never reached the proxy
export const config = {
    matcher: ['/', '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.webmanifest$|sw\\.js$|offline\\.html$).*)']
}
