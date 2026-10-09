import { ApiType } from '@/api'

import {
    buildCategoryHref,
    buildLocationHref,
    buildPlacesHref,
    getLandingFlags,
    isLandingSegment,
    LandingFlags
} from './placesLanding'

const DEFAULT_SORT = ApiType.SortFields.Trending
const DEFAULT_ORDER = ApiType.SortOrders.DESC

const ALL_OFF: LandingFlags = { categories: false, combinations: false, locations: false }
const CATEGORIES_ON: LandingFlags = { categories: true, combinations: false, locations: false }
const LOCATIONS_ON: LandingFlags = { categories: false, combinations: false, locations: true }
const CATEGORIES_AND_LOCATIONS_ON: LandingFlags = { categories: true, combinations: false, locations: true }
const ALL_ON: LandingFlags = { categories: true, combinations: true, locations: true }

const bashkortostan = { id: 2, slug: 'bashkortostan', type: 'region' as const }
const unslugged = { id: 9, slug: null, type: 'region' as const }

const base = { defaultOrder: DEFAULT_ORDER, defaultSort: DEFAULT_SORT }

describe('getLandingFlags', () => {
    const originalEnv = process.env

    afterEach(() => {
        process.env = originalEnv
    })

    it('is all off when no env vars are set', () => {
        process.env = { ...originalEnv }
        delete process.env.NEXT_PUBLIC_LANDING_CATEGORIES
        delete process.env.NEXT_PUBLIC_LANDING_LOCATIONS
        delete process.env.NEXT_PUBLIC_LANDING_COMBINATIONS

        expect(getLandingFlags()).toEqual({ categories: false, combinations: false, locations: false })
    })

    it('forces combinations off when locations is off, even if its own var is true', () => {
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_LANDING_COMBINATIONS: 'true',
            NEXT_PUBLIC_LANDING_LOCATIONS: 'false'
        }

        expect(getLandingFlags().combinations).toBe(false)
    })

    it('reads all three independently when locations is on', () => {
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_LANDING_CATEGORIES: 'true',
            NEXT_PUBLIC_LANDING_COMBINATIONS: 'true',
            NEXT_PUBLIC_LANDING_LOCATIONS: 'true'
        }

        expect(getLandingFlags()).toEqual({ categories: true, combinations: true, locations: true })
    })
})

describe("buildPlacesHref — all flags off (today's behaviour, byte-for-byte)", () => {
    it('plain /places with no filter', () => {
        expect(buildPlacesHref({ ...base }, ALL_OFF)).toMatchObject({ href: '/places', pathname: '/places' })
    })

    it('a category stays a query param', () => {
        expect(buildPlacesHref({ ...base, category: 'cave' }, ALL_OFF)).toMatchObject({
            href: '/places?category=cave',
            pathname: '/places'
        })
    })

    it('a location stays the legacy numeric query param for its level', () => {
        expect(buildPlacesHref({ ...base, location: bashkortostan }, ALL_OFF)).toMatchObject({
            href: '/places?region=2',
            pathname: '/places'
        })
    })

    it('a location + category combination stays fully on query params', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', location: bashkortostan }, ALL_OFF)).toMatchObject({
            href: '/places?category=cave&region=2',
            pathname: '/places'
        })
    })
})

describe('buildPlacesHref — stage 2, categories only', () => {
    it('a single category becomes a path', () => {
        expect(buildPlacesHref({ ...base, category: 'cave' }, CATEGORIES_ON)).toMatchObject({
            categoryInPath: 'cave',
            href: '/places/cave',
            pathname: '/places/cave'
        })
    })

    it('2+ categories never join the path, even with the flag on', () => {
        const result = buildPlacesHref({ ...base, category: ['cave', 'mine'] }, CATEGORIES_ON)

        expect(result).toMatchObject({ href: '/places?category=cave%2Cmine', multiCategory: true, pathname: '/places' })
        expect(result.categoryInPath).toBeUndefined()
    })

    it('a category combined with a location stays entirely on query params — the pair only moves at stage 4', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', location: bashkortostan }, CATEGORIES_ON)).toMatchObject({
            href: '/places?category=cave&region=2',
            pathname: '/places'
        })
    })

    it('a lone location is unaffected — locations flag is still off', () => {
        expect(buildPlacesHref({ ...base, location: bashkortostan }, CATEGORIES_ON)).toMatchObject({
            href: '/places?region=2',
            pathname: '/places'
        })
    })
})

describe('buildPlacesHref — stage 3, locations only', () => {
    it('a location becomes a path', () => {
        expect(buildPlacesHref({ ...base, location: bashkortostan }, LOCATIONS_ON)).toMatchObject({
            href: '/places/bashkortostan',
            locationInPath: 'bashkortostan',
            pathname: '/places/bashkortostan'
        })
    })

    it('a location without a slug yet falls back to the legacy query param', () => {
        expect(buildPlacesHref({ ...base, location: unslugged }, LOCATIONS_ON)).toMatchObject({
            href: '/places?region=9',
            pathname: '/places'
        })
    })

    it('a category alone is unaffected — categories flag is still off', () => {
        expect(buildPlacesHref({ ...base, category: 'cave' }, LOCATIONS_ON)).toMatchObject({
            href: '/places?category=cave',
            pathname: '/places'
        })
    })

    it('a location + category stays a query param on the location page — combinations is off', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', location: bashkortostan }, LOCATIONS_ON)).toMatchObject({
            categoryInPath: undefined,
            href: '/places/bashkortostan?category=cave',
            locationInPath: 'bashkortostan',
            pathname: '/places/bashkortostan'
        })
    })
})

describe('buildPlacesHref — categories + locations on, combinations still off', () => {
    it('location and category each build their own single-segment path independently', () => {
        expect(buildPlacesHref({ ...base, category: 'cave' }, CATEGORIES_AND_LOCATIONS_ON)).toMatchObject({
            href: '/places/cave',
            pathname: '/places/cave'
        })
        expect(buildPlacesHref({ ...base, location: bashkortostan }, CATEGORIES_AND_LOCATIONS_ON)).toMatchObject({
            href: '/places/bashkortostan',
            pathname: '/places/bashkortostan'
        })
    })

    it('a pair still stays query-param-only — the combinations flag gates the pair URL, not the two flags together', () => {
        expect(
            buildPlacesHref({ ...base, category: 'cave', location: bashkortostan }, CATEGORIES_AND_LOCATIONS_ON)
        ).toMatchObject({ href: '/places/bashkortostan?category=cave', pathname: '/places/bashkortostan' })
    })
})

describe('buildPlacesHref — stage 4, all flags on', () => {
    it('a location + single category becomes the pair path', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', location: bashkortostan }, ALL_ON)).toMatchObject({
            categoryInPath: 'cave',
            href: '/places/bashkortostan/cave',
            locationInPath: 'bashkortostan',
            pathname: '/places/bashkortostan/cave'
        })
    })

    it('2+ categories with a location: location path + category query, canonical without category', () => {
        expect(buildPlacesHref({ ...base, category: ['cave', 'mine'], location: bashkortostan }, ALL_ON)).toMatchObject(
            {
                href: '/places/bashkortostan?category=cave%2Cmine',
                multiCategory: true,
                pathname: '/places/bashkortostan'
            }
        )
    })

    it('a location without a slug keeps the pair on query params entirely', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', location: unslugged }, ALL_ON)).toMatchObject({
            href: '/places?category=cave&region=9',
            pathname: '/places'
        })
    })
})

describe('buildPlacesHref — extra params survive on top of the canonical path', () => {
    it('tag, non-default sort/order and page 2+ stay as query params', () => {
        expect(
            buildPlacesHref(
                {
                    ...base,
                    category: 'cave',
                    order: ApiType.SortOrders.ASC,
                    page: 3,
                    sort: ApiType.SortFields.Rating,
                    tag: 'waterfall'
                },
                CATEGORIES_ON
            )
        ).toMatchObject({ href: '/places/cave?order=ASC&page=3&sort=rating&tag=waterfall', pathname: '/places/cave' })
    })

    it('page 1 and the default sort/order are dropped, not just hidden', () => {
        expect(
            buildPlacesHref(
                { ...base, category: 'cave', order: DEFAULT_ORDER, page: 1, sort: DEFAULT_SORT },
                CATEGORIES_ON
            )
        ).toMatchObject({ href: '/places/cave', pathname: '/places/cave' })
    })

    it('a geo filter (lat/lon) is kept as a query param alongside a landing path', () => {
        expect(buildPlacesHref({ ...base, category: 'cave', lat: 51.7, lon: 55.1 }, CATEGORIES_ON)).toMatchObject({
            href: '/places/cave?lat=51.7&lon=55.1',
            pathname: '/places/cave'
        })
    })
})

describe('isLandingSegment', () => {
    it('rejects a bare 13-char hex place id', () => {
        expect(isLandingSegment('abc0123456789')).toBe(false)
    })

    it('rejects a slugged place id', () => {
        expect(isLandingSegment('abc0123456789-eiffel-tower')).toBe(false)
    })

    it('rejects the create and edit routes', () => {
        expect(isLandingSegment('create')).toBe(false)
        expect(isLandingSegment('edit')).toBe(false)
    })

    it('rejects "landing" — the proxy\'s own rewrite destination, never a valid slug', () => {
        expect(isLandingSegment('landing')).toBe(false)
    })

    it('accepts a category or location slug', () => {
        expect(isLandingSegment('cave')).toBe(true)
        expect(isLandingSegment('bashkortostan')).toBe(true)
    })

    it('rejects an empty segment', () => {
        expect(isLandingSegment('')).toBe(false)
    })
})

describe('buildCategoryHref', () => {
    it('stays a query param with the flag off', () => {
        expect(buildCategoryHref('cave', ALL_OFF)).toBe('/places?category=cave')
    })

    it('becomes a path with the flag on', () => {
        expect(buildCategoryHref('cave', CATEGORIES_ON)).toBe('/places/cave')
    })
})

describe('buildLocationHref', () => {
    it('stays the legacy query param with the flag off', () => {
        expect(buildLocationHref(bashkortostan, ALL_OFF)).toBe('/places?region=2')
    })

    it('becomes a path with the flag on and a slug', () => {
        expect(buildLocationHref(bashkortostan, LOCATIONS_ON)).toBe('/places/bashkortostan')
    })

    it('falls back to the query param with the flag on but no slug yet', () => {
        expect(buildLocationHref(unslugged, LOCATIONS_ON)).toBe('/places?region=9')
    })
})
