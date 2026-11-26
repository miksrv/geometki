import { sitePathname } from './sitePathname'

describe('sitePathname', () => {
    it('reads a live page as the page the visitor is on', () => {
        expect(sitePathname('/live')).toBe('/')
        expect(sitePathname('/live/places/[id]')).toBe('/places/[id]')
        expect(sitePathname('/live/collections/[id]')).toBe('/collections/[id]')
        expect(sitePathname('/live/users/[id]')).toBe('/users/[id]')
        expect(sitePathname('/live/activity')).toBe('/activity')
    })

    it('leaves the other routes alone', () => {
        expect(sitePathname('/')).toBe('/')
        expect(sitePathname('/places/[id]')).toBe('/places/[id]')
        expect(sitePathname('/lively')).toBe('/lively')
    })
})
