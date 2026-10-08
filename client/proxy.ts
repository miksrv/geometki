import type { NextRequest } from 'next/server'

import { AUTH_COOKIES } from '@/config/constants'

export const proxy = (request: NextRequest) => {
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
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
}
