import { buildCollectionUrl, parseCollectionId } from './collection'

describe('buildCollectionUrl', () => {
    it('returns the bare id URL when slug is undefined', () => {
        expect(buildCollectionUrl('abc0123456789')).toBe('/collections/abc0123456789')
    })

    it('appends the slug when present', () => {
        expect(buildCollectionUrl('abc0123456789', 'vodopady-krasnodarskogo-kraya')).toBe(
            '/collections/abc0123456789-vodopady-krasnodarskogo-kraya'
        )
    })
})

describe('parseCollectionId', () => {
    it('strips the slug from a slugged id', () => {
        expect(parseCollectionId('abc0123456789-vodopady-krasnodarskogo-kraya')).toBe('abc0123456789')
    })

    it('returns the bare id unchanged', () => {
        expect(parseCollectionId('abc0123456789')).toBe('abc0123456789')
    })
})
