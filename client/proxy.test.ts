/**
 * @jest-environment node
 */
import { NextURL } from 'next/dist/server/web/next-url'
import type { NextRequest } from 'next/server'

import { proxy } from './proxy'

jest.mock('@/config/constants', () => ({
    AUTH_COOKIES: { TOKEN: 'token', SESSION: 'session' }
}))

// Only the parts of NextRequest the proxy reads
const request = (path: string, token?: string) => {
    // Like in Next: with i18n the locale prefix is parsed out of nextUrl.pathname
    const nextUrl = new NextURL(new URL(path, 'http://localhost:3000'), {
        nextConfig: { i18n: { defaultLocale: 'ru', locales: ['ru', 'en'] } }
    })

    return {
        cookies: { get: (name: string) => (name === 'token' && token ? { value: token } : undefined) },
        nextUrl,
        url: nextUrl.toString()
    } as unknown as NextRequest
}

const location = (response?: Response) => response?.headers.get('location')

describe('proxy', () => {
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
            expect(proxy(request('/places/abc123/edit', 'jwt'))).toBeUndefined()
        })

        it('does not touch the place page itself', () => {
            expect(proxy(request('/places/abc123'))).toBeUndefined()
        })
    })

    it('still sends guests away from creating a place', () => {
        expect(location(proxy(request('/places/create')))).toBe('http://localhost:3000/places')
    })
})
