/**
 * @jest-environment node
 */
import { NextURL } from 'next/dist/server/web/next-url'
import type { NextRequest } from 'next/server'

import { proxy } from './proxy'

jest.mock('@/config/constants', () => ({
    AUTH_COOKIES: { TOKEN: 'token', SESSION: 'session' }
}))

let mockFlags = { categories: false, combinations: false, locations: false }
jest.mock('@/utils/placesLanding', () => ({
    getLandingFlags: () => mockFlags,
    isLandingSegment: (segment: string) =>
        !!segment && segment !== 'create' && segment !== 'edit' && !/^[0-9a-f]{13}(-|$)/.test(segment),
    LANDING_PROXY_HEADER: 'x-landing-proxied'
}))

// Only the parts of NextRequest the proxy reads
const request = (path: string, token?: string, headers?: Record<string, string>) => {
    // Like in Next: with i18n the locale prefix is parsed out of nextUrl.pathname
    const nextUrl = new NextURL(new URL(path, 'http://localhost:3000'), {
        nextConfig: { i18n: { defaultLocale: 'ru', locales: ['ru', 'en'] } }
    })

    return {
        cookies: { get: (name: string) => (name === 'token' && token ? { value: token } : undefined) },
        headers: new Headers(headers),
        nextUrl,
        url: nextUrl.toString()
    } as unknown as NextRequest
}

const location = (response?: Response) => response?.headers.get('location')
const rewrite = (response?: Response) => response?.headers.get('x-middleware-rewrite')
const proxiedHeader = (response?: Response) => response?.headers.get('x-middleware-request-x-landing-proxied')
/** True for a plain "continue" response (`NextResponse.next()`), as opposed to a redirect or rewrite */
const isPassThrough = (response?: Response) => response?.headers.get('x-middleware-next') === '1'

describe('proxy', () => {
    beforeEach(() => {
        mockFlags = { categories: false, combinations: false, locations: false }
    })

    describe('landing rewrite (features/20-location-seo-pages.md)', () => {
        it('does nothing for a single segment with every flag off (the behaviour before this feature)', () => {
            expect(isPassThrough(proxy(request('/places/cave')))).toBe(true)
            expect(rewrite(proxy(request('/places/cave')))).toBeNull()
        })

        it('rewrites a single non-id segment to the landing page once categories is on', () => {
            mockFlags = { categories: true, combinations: false, locations: false }
            expect(rewrite(proxy(request('/places/cave')))).toBe('http://localhost:3000/places/landing/cave')
        })

        it('rewrites a single non-id segment to the landing page once locations is on', () => {
            mockFlags = { categories: false, combinations: false, locations: true }
            expect(rewrite(proxy(request('/places/bashkortostan')))).toBe(
                'http://localhost:3000/places/landing/bashkortostan'
            )
        })

        it('keeps the locale prefix on the rewritten URL', () => {
            mockFlags = { categories: true, combinations: false, locations: false }
            expect(rewrite(proxy(request('/en/places/cave')))).toBe('http://localhost:3000/en/places/landing/cave')
        })

        it('never rewrites a bare place id, flags or not', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(rewrite(proxy(request('/places/abc0123456789')))).toBeNull()
            expect(rewrite(proxy(request('/places/abc0123456789-eiffel-tower')))).toBeNull()
        })

        it('never rewrites /places/create', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            // Guest redirect takes priority; signed-in request should fall through untouched
            expect(rewrite(proxy(request('/places/create', 'jwt')))).toBeNull()
        })

        it('does not rewrite a two-segment path when combinations is off, even with the other two flags on', () => {
            mockFlags = { categories: true, combinations: false, locations: true }
            expect(rewrite(proxy(request('/places/bashkortostan/cave')))).toBeNull()
        })

        it('rewrites a two-segment path once combinations is on', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(rewrite(proxy(request('/places/bashkortostan/cave')))).toBe(
                'http://localhost:3000/places/landing/bashkortostan/cave'
            )
        })

        it('marks a single-segment rewrite with a proxied header value', () => {
            mockFlags = { categories: true, combinations: false, locations: false }
            expect(proxiedHeader(proxy(request('/places/cave')))).toBeTruthy()
        })

        it('marks a two-segment rewrite with a proxied header value too', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(proxiedHeader(proxy(request('/places/bashkortostan/cave')))).toBeTruthy()
        })

        it('still lets a signed-in user through to /places/{id}/edit when combinations is on', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(rewrite(proxy(request('/places/abc0123456789/edit', 'jwt')))).toBeNull()
            expect(location(proxy(request('/places/abc0123456789/edit', 'jwt')))).toBeNull()
        })
    })

    describe('direct access to /places/landing (review findings, 2026-10-09)', () => {
        it('301s a bare /places/landing hit to /places, no header', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(location(proxy(request('/places/landing')))).toBe('http://localhost:3000/places')
        })

        it('301s a single-segment direct hit, stripping only the "landing/" segment', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(location(proxy(request('/places/landing/bashkortostan')))).toBe(
                'http://localhost:3000/places/bashkortostan'
            )
        })

        it('301s a two-segment (pair) direct hit the same way', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(location(proxy(request('/places/landing/bashkortostan/cave')))).toBe(
                'http://localhost:3000/places/bashkortostan/cave'
            )
        })

        it('keeps the locale prefix and the query string on the redirect', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            expect(location(proxy(request('/en/places/landing/bashkortostan?page=2')))).toBe(
                'http://localhost:3000/en/places/bashkortostan?page=2'
            )
        })

        it('redirects even with every landing flag off — the duplicate path must never serve content regardless', () => {
            expect(location(proxy(request('/places/landing/bashkortostan')))).toBe(
                'http://localhost:3000/places/bashkortostan'
            )
        })

        it('spoofing the header with a guessed value ("1") still gets redirected, not let through', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            const response = proxy(request('/places/landing/bashkortostan', undefined, { 'x-landing-proxied': '1' }))
            expect(location(response)).toBe('http://localhost:3000/places/bashkortostan')
            expect(isPassThrough(response)).toBe(false)
        })

        it('spoofing the header with an empty or arbitrary guess still gets redirected', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            const response = proxy(request('/places/landing/bashkortostan', undefined, { 'x-landing-proxied': 'true' }))
            expect(location(response)).toBe('http://localhost:3000/places/bashkortostan')
        })

        it('regression: redirects rather than nesting a second rewrite — the old bug produced /places/landing/landing/cave', () => {
            mockFlags = { categories: true, combinations: true, locations: true }
            const response = proxy(request('/places/landing/cave'))
            expect(rewrite(response)).toBeNull()
            expect(location(response)).toBe('http://localhost:3000/places/cave')
        })

        it('end to end: the real rewrite response for /places/cave, round-tripped back into the proxy as Next would, passes straight through — not redirected', () => {
            mockFlags = { categories: true, combinations: false, locations: false }

            const firstPass = proxy(request('/places/cave'))
            const realSecret = proxiedHeader(firstPass)
            expect(realSecret).toBeTruthy()

            const secondPass = proxy(request('/places/landing/cave', undefined, { 'x-landing-proxied': realSecret! }))

            expect(isPassThrough(secondPass)).toBe(true)
            expect(location(secondPass)).toBeNull()
        })
    })

    describe('x-landing-proxied is stripped from every external request (review finding, 2026-10-09)', () => {
        it('is not forwarded on an unrelated path, even when the client sends it', () => {
            const response = proxy(request('/collections/123', undefined, { 'x-landing-proxied': 'spoofed' }))
            expect(proxiedHeader(response)).toBeNull()
        })

        it('is not forwarded on the home page either', () => {
            const response = proxy(request('/', undefined, { 'x-landing-proxied': 'spoofed' }))
            expect(proxiedHeader(response)).toBeNull()
        })

        it('a spoofed value on the rewrite-triggering request itself is replaced by the real secret, not forwarded as-is', () => {
            mockFlags = { categories: true, combinations: false, locations: false }
            const response = proxy(request('/places/cave', undefined, { 'x-landing-proxied': 'spoofed' }))
            expect(proxiedHeader(response)).not.toBe('spoofed')
            expect(proxiedHeader(response)).toBeTruthy()
        })
    })

    describe('place edit page', () => {
        it('sends guests back to the place', () => {
            expect(location(proxy(request('/places/abc123/edit')))).toBe('http://localhost:3000/places/abc123')
        })

        it('keeps the English locale prefix', () => {
            expect(location(proxy(request('/en/places/abc123-slug/edit')))).toBe(
                'http://localhost:3000/en/places/abc123-slug'
            )
        })

        it('lets signed-in users through', () => {
            expect(location(proxy(request('/places/abc123/edit', 'jwt')))).toBeNull()
        })

        it('does not touch the place page itself', () => {
            expect(location(proxy(request('/places/abc123')))).toBeNull()
            expect(rewrite(proxy(request('/places/abc123')))).toBeNull()
        })
    })

    it('still sends guests away from creating a place', () => {
        expect(location(proxy(request('/places/create')))).toBe('http://localhost:3000/places')
    })
})
