import type { NextRequest } from 'next/server'

import { AUTH_COOKIES } from '@/config/constants'

export const middleware = (request: NextRequest) => {
    const currentUser = request.cookies.get(AUTH_COOKIES.TOKEN)?.value

    if (!currentUser && request.nextUrl.pathname.startsWith('/places/create')) {
        return Response.redirect(new URL('/places', request.url))
    }

    if (!currentUser && request.nextUrl.pathname.startsWith('/users/settings')) {
        return Response.redirect(new URL('/users', request.url))
    }

    if (currentUser && request.nextUrl.pathname.startsWith('/auth')) {
        return Response.redirect(new URL('/', request.url))
    }
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
}
