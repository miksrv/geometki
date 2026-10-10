import type { LandingClassification, ResolvedSegment } from './placesLandingResolve'
// eslint-disable-next-line no-duplicate-imports -- see the note in `proxy.ts`
import {
    buildLandingCanonicalPath,
    classifyLandingSegments,
    computeLandingNoindex,
    decideLandingRedirect,
    isLandingEmpty,
    isLandingPageOutOfRange
} from './placesLandingResolve'

const location = (slug: string | null): ResolvedSegment => ({ kind: 'location', slug })
const category = (name: string): ResolvedSegment => ({ kind: 'category', name })

describe('classifyLandingSegments', () => {
    it('one segment, a location with a slug → location page', () => {
        expect(classifyLandingSegments(location('bashkortostan'), null)).toStrictEqual({
            kind: 'location',
            locationSlug: 'bashkortostan'
        })
    })

    it('one segment, a category → category page', () => {
        expect(classifyLandingSegments(category('cave'), null)).toStrictEqual({
            categoryName: 'cave',
            kind: 'category'
        })
    })

    it('one segment, a location without a slug yet → not-found', () => {
        expect(classifyLandingSegments(location(null), null)).toStrictEqual({ kind: 'not-found' })
    })

    it('one segment, nothing resolved → not-found', () => {
        expect(classifyLandingSegments(null, null)).toStrictEqual({ kind: 'not-found' })
    })

    it('two segments, location then category → pair, not reversed', () => {
        expect(classifyLandingSegments(location('bashkortostan'), category('cave'))).toStrictEqual({
            categoryName: 'cave',
            kind: 'pair',
            locationSlug: 'bashkortostan',
            reversed: false
        })
    })

    it('two segments, category then location → pair, reversed', () => {
        expect(classifyLandingSegments(category('cave'), location('bashkortostan'))).toStrictEqual({
            categoryName: 'cave',
            kind: 'pair',
            locationSlug: 'bashkortostan',
            reversed: true
        })
    })

    it('two segments, location without a slug → not-found even though the pair would otherwise resolve', () => {
        expect(classifyLandingSegments(location(null), category('cave'))).toStrictEqual({ kind: 'not-found' })
        expect(classifyLandingSegments(category('cave'), location(null))).toStrictEqual({ kind: 'not-found' })
    })

    it('two segments, both locations or both categories → not-found', () => {
        expect(classifyLandingSegments(location('bashkortostan'), location('orenburg'))).toStrictEqual({
            kind: 'not-found'
        })
        expect(classifyLandingSegments(category('cave'), category('industrial'))).toStrictEqual({ kind: 'not-found' })
    })
})

describe('buildLandingCanonicalPath', () => {
    it('builds each kind', () => {
        expect(buildLandingCanonicalPath({ categoryName: 'cave', kind: 'category' })).toBe('/places/cave')
        expect(buildLandingCanonicalPath({ kind: 'location', locationSlug: 'bashkortostan' })).toBe(
            '/places/bashkortostan'
        )
        expect(
            buildLandingCanonicalPath({
                categoryName: 'cave',
                kind: 'pair',
                locationSlug: 'bashkortostan',
                reversed: false
            })
        ).toBe('/places/bashkortostan/cave')
    })

    it('returns null for not-found', () => {
        expect(buildLandingCanonicalPath({ kind: 'not-found' })).toBeNull()
    })
})

describe('decideLandingRedirect', () => {
    const pairClassification: LandingClassification = {
        categoryName: 'cave',
        kind: 'pair',
        locationSlug: 'bashkortostan',
        reversed: false
    }

    it('renders normally when proxied and the requested segments already match canonical', () => {
        expect(
            decideLandingRedirect({
                classification: pairClassification,
                isProxied: true,
                requestedSegments: ['bashkortostan', 'cave']
            })
        ).toBeNull()
    })

    it('301s to the canonical path when not proxied, even if the segments already match — a direct hit on /places/landing/... must never serve content', () => {
        expect(
            decideLandingRedirect({
                classification: pairClassification,
                isProxied: false,
                requestedSegments: ['bashkortostan', 'cave']
            })
        ).toBe('/places/bashkortostan/cave')
    })

    it('301s to the canonical order when the request had the pair reversed', () => {
        const reversed: LandingClassification = { ...pairClassification, reversed: true }
        expect(
            decideLandingRedirect({
                classification: reversed,
                isProxied: true,
                requestedSegments: ['cave', 'bashkortostan']
            })
        ).toBe('/places/bashkortostan/cave')
    })

    it('301s when the requested slug is superseded (resolved to a different canonical slug)', () => {
        expect(
            decideLandingRedirect({
                classification: { kind: 'location', locationSlug: 'bashkortostan' },
                isProxied: true,
                requestedSegments: ['republic-of-bashkortostan']
            })
        ).toBe('/places/bashkortostan')
    })

    it('returns null (caller 404s) when nothing resolved', () => {
        expect(
            decideLandingRedirect({ classification: { kind: 'not-found' }, isProxied: true, requestedSegments: ['x'] })
        ).toBeNull()
    })
})

describe('isLandingEmpty', () => {
    it('true for 0 or negative, false otherwise', () => {
        expect(isLandingEmpty(0)).toBe(true)
        expect(isLandingEmpty(1)).toBe(false)
    })
})

describe('isLandingPageOutOfRange', () => {
    it('true only past page 1 with nothing on the page', () => {
        expect(isLandingPageOutOfRange(2, 0)).toBe(true)
        expect(isLandingPageOutOfRange(1, 0)).toBe(false)
        expect(isLandingPageOutOfRange(2, 5)).toBe(false)
    })
})

describe('computeLandingNoindex', () => {
    it('noindex for a geo filter', () => {
        expect(computeLandingNoindex({ indexable: true, isGeoFiltered: true, multiCategory: false })).toBe(true)
    })

    it('noindex for 2+ categories', () => {
        expect(computeLandingNoindex({ indexable: true, isGeoFiltered: false, multiCategory: true })).toBe(true)
    })

    it('noindex when below the indexing threshold', () => {
        expect(computeLandingNoindex({ indexable: false, isGeoFiltered: false, multiCategory: false })).toBe(true)
    })

    it('indexable, geo-free, single category → not noindex', () => {
        expect(computeLandingNoindex({ indexable: true, isGeoFiltered: false, multiCategory: false })).toBe(false)
    })
})
