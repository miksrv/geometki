import { applyFilterPatch, buildFilterHref, describeFilter, filterToListRequest, isNearFilter } from './describeFilter'
import { PlacesFilterState } from './types'

jest.mock('@/utils/categories', () => ({
    getCategoryShortTitle: (_t: unknown, name: string) =>
        ({ abandoned: 'Заброшки', cave: 'Пещеры', water: 'Озёра' })[name] ?? name
}))

const t = ((key: string, defaultValue?: string) => defaultValue ?? key) as any

const base: PlacesFilterState = { categories: [], notVisited: false, sort: 'trending' }
const region = { id: 56, name: 'Оренбургская область', slug: 'orenburg-oblast', type: 'region' as const }
const flagsOff = { categories: false, combinations: false, locations: false }
const options = { defaultOrder: 'DESC' as const, defaultSort: 'trending' as const, flags: flagsOff }

describe('describeFilter', () => {
    it('summarises categories, location and the visited filter', () => {
        expect(
            describeFilter(t, {
                ...base,
                categories: ['abandoned', 'cave', 'water'],
                location: region,
                notVisited: true
            })
        ).toBe('Заброшки, Пещеры +1 · Оренбургская область · без посещённых')
    })

    it('names "near me" when sorted by distance without a location', () => {
        const near = { ...base, sort: 'distance' as const }

        expect(isNearFilter(near)).toBe(true)
        expect(describeFilter(t, near)).toBe('Рядом со мной')
    })
})

describe('applyFilterPatch', () => {
    it('changes only the given keys and clears with null', () => {
        const filter = { ...base, categories: ['cave'], location: region, tag: 'lake' }

        expect(applyFilterPatch(filter, { notVisited: true })).toStrictEqual({ ...filter, notVisited: true })
        expect(applyFilterPatch(filter, { location: null, tag: null })).toStrictEqual({
            ...filter,
            location: undefined,
            tag: undefined
        })
    })
})

describe('buildFilterHref', () => {
    it('builds the legacy query with the flags off', () => {
        expect(
            buildFilterHref(base, { categories: ['cave', 'water'], location: region, notVisited: true }, options)
        ).toBe('/places?category=cave%2Cwater&notVisited=1&region=56')
    })

    it('goes to the location page once the flag is on and the location has a slug', () => {
        expect(
            buildFilterHref(base, { location: region }, { ...options, flags: { ...flagsOff, locations: true } })
        ).toBe('/places/orenburg-oblast')
    })

    it('drops the order of an old link once a sort is picked, keeps it otherwise', () => {
        const withOrder = { ...options, order: 'ASC' as const }

        expect(buildFilterHref(base, { categories: ['cave'] }, withOrder)).toBe('/places?category=cave&order=ASC')
        expect(buildFilterHref(base, { sort: 'rating' }, withOrder)).toBe('/places?sort=rating')
    })
})

describe('filterToListRequest', () => {
    it('maps the state to the list request', () => {
        expect(
            filterToListRequest({ ...base, categories: ['cave', 'water'], location: region, notVisited: true })
        ).toStrictEqual({
            category: 'cave,water',
            notVisited: 1,
            region: 56,
            tag: undefined
        })
    })
})
