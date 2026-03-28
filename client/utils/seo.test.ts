// Mock env before importing seo to control SITE_LINK value
import { buildHreflangTags } from './seo'

jest.mock('@/config/env', () => ({
    SITE_LINK: 'https://geometki.com/'
}))

describe('buildHreflangTags', () => {
    it('returns three alternate link objects', () => {
        const tags = buildHreflangTags('places/123')
        expect(tags).toHaveLength(3)
    })

    it('produces correct ru hreflang url', () => {
        const tags = buildHreflangTags('places/123')
        const ruTag = tags.find((t) => t.hrefLang === 'ru')
        expect(ruTag?.href).toBe('https://geometki.com/places/123')
    })

    it('produces correct en hreflang url', () => {
        const tags = buildHreflangTags('places/123')
        const enTag = tags.find((t) => t.hrefLang === 'en')
        expect(enTag?.href).toBe('https://geometki.com/en/places/123')
    })

    it('x-default points to the ru url', () => {
        const tags = buildHreflangTags('places/123')
        const xDefault = tags.find((t) => t.hrefLang === 'x-default')
        const ruTag = tags.find((t) => t.hrefLang === 'ru')
        expect(xDefault?.href).toBe(ruTag?.href)
    })

    it('handles empty path (homepage)', () => {
        const tags = buildHreflangTags('')
        const ruTag = tags.find((t) => t.hrefLang === 'ru')
        const enTag = tags.find((t) => t.hrefLang === 'en')
        expect(ruTag?.href).toBe('https://geometki.com/')
        expect(enTag?.href).toBe('https://geometki.com/en')
    })

    it('all tags have rel="alternate"', () => {
        const tags = buildHreflangTags('about')
        tags.forEach((tag) => expect(tag.rel).toBe('alternate'))
    })
})
