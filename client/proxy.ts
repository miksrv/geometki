import type { NextRequest } from 'next/server'
// Two lint rules disagree on this one: `import/consistent-type-specifier-style` wants the
// type import split out of the value import above, `no-duplicate-imports` then flags the
// split as a duplicate source — there is no form that satisfies both.
// eslint-disable-next-line no-duplicate-imports
import { NextResponse } from 'next/server'

import { AUTH_COOKIES } from '@/config/constants'
import { getLandingFlags, isLandingSegment, LANDING_PROXY_HEADER } from '@/utils/placesLanding'

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

export const proxy = (request: NextRequest) => {
    // Never trust a client-supplied copy of this header, on any path — only this file's own
    // rewrite below (further down) is allowed to set it, and only to `PROXY_SECRET`. Every
    // response that lets a request continue forwards this sanitized copy instead of the raw
    // incoming headers.
    const sanitizedHeaders = new Headers(request.headers)
    sanitizedHeaders.delete(LANDING_PROXY_HEADER)

    // Direct access to the internal landing route (features/20-location-seo-pages.md):
    // handled first, before any other rule below reads the path, so nothing can ever serve
    // content at `/places/landing/...` (or `/en/places/landing/...` — nextUrl.pathname has
    // the locale prefix already stripped) itself; only this proxy's own rewrite, which alone
    // knows `PROXY_SECRET`, may continue past this point with that exact pathname.
    if (request.nextUrl.pathname.startsWith('/places/landing')) {
        if (request.headers.get(LANDING_PROXY_HEADER) === PROXY_SECRET) {
            return NextResponse.next({ request: { headers: sanitizedHeaders } })
        }

        const url = request.nextUrl.clone()
        url.pathname = url.pathname.replace(/^\/places\/landing(?=\/|$)/, '/places')
        return Response.redirect(url.toString(), 301)
    }

    const currentUser = request.cookies.get(AUTH_COOKIES.TOKEN)?.value

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

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
}
