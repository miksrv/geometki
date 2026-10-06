import { buildPlaceUrl, parsePlaceId } from './place'

describe('buildPlaceUrl', () => {
    it('returns the bare id URL when slug is undefined', () => {
        expect(buildPlaceUrl('abc0123456789')).toBe('/places/abc0123456789')
    })

    it('returns the bare id URL when slug is null', () => {
        expect(buildPlaceUrl('abc0123456789', null)).toBe('/places/abc0123456789')
    })

    it('returns the bare id URL when slug is an empty string', () => {
        expect(buildPlaceUrl('abc0123456789', '')).toBe('/places/abc0123456789')
    })

    it('appends the slug when present', () => {
        expect(buildPlaceUrl('abc0123456789', 'eiffel-tower')).toBe('/places/abc0123456789-eiffel-tower')
    })
})

describe('parsePlaceId', () => {
    it('returns an empty string for undefined', () => {
        expect(parsePlaceId(undefined)).toBe('')
    })

    it('returns the bare id unchanged', () => {
        expect(parsePlaceId('abc0123456789')).toBe('abc0123456789')
    })

    it('strips the slug from a slugged id', () => {
        expect(parsePlaceId('abc0123456789-eiffel-tower')).toBe('abc0123456789')
    })

    it('uses the first array element when param is an array', () => {
        expect(parsePlaceId(['abc0123456789-eiffel-tower', 'ignored'])).toBe('abc0123456789')
    })

    it('returns an empty string for an empty array', () => {
        expect(parsePlaceId([])).toBe('')
    })
})
