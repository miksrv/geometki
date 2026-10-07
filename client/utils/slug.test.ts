import { buildSluggedUrl, parseSluggedId } from './slug'

describe('buildSluggedUrl', () => {
    it('returns the bare id URL when slug is undefined', () => {
        expect(buildSluggedUrl('/places', 'abc0123456789')).toBe('/places/abc0123456789')
    })

    it('returns the bare id URL when slug is null', () => {
        expect(buildSluggedUrl('/collections', 'abc0123456789', null)).toBe('/collections/abc0123456789')
    })

    it('returns the bare id URL when slug is an empty string', () => {
        expect(buildSluggedUrl('/collections', 'abc0123456789', '')).toBe('/collections/abc0123456789')
    })

    it('appends the slug when present', () => {
        expect(buildSluggedUrl('/collections', 'abc0123456789', 'waterfalls')).toBe(
            '/collections/abc0123456789-waterfalls'
        )
    })
})

describe('parseSluggedId', () => {
    it('returns an empty string for undefined', () => {
        expect(parseSluggedId(undefined)).toBe('')
    })

    it('returns the bare id unchanged', () => {
        expect(parseSluggedId('abc0123456789')).toBe('abc0123456789')
    })

    it('strips the slug from a slugged id', () => {
        expect(parseSluggedId('abc0123456789-waterfalls')).toBe('abc0123456789')
    })

    it('uses the first array element when param is an array', () => {
        expect(parseSluggedId(['abc0123456789-waterfalls', 'ignored'])).toBe('abc0123456789')
    })

    it('returns an empty string for an empty array', () => {
        expect(parseSluggedId([])).toBe('')
    })
})
