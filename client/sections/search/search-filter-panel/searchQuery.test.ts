import { buildSearchHref, countFacets, parseSearchQuery, SearchQuery } from './searchQuery'

const base: SearchQuery = { categories: [], q: 'Оренбург', sort: 'relevance', type: 'all' }

describe('parseSearchQuery', () => {
    it('reads the URL and drops what it does not know', () => {
        expect(
            parseSearchQuery({
                category: 'cave,nope,cave,castle',
                order: 'asc',
                q: ' Оренбург ',
                sort: 'views',
                type: 'places'
            })
        ).toEqual({ categories: ['cave', 'castle'], q: 'Оренбург', sort: 'views', type: 'places' })
    })

    it('falls back to the defaults', () => {
        expect(parseSearchQuery({ q: 'x', sort: 'title', type: 'photos' })).toEqual({
            categories: [],
            q: 'x',
            sort: 'relevance',
            type: 'all'
        })
    })
})

describe('buildSearchHref', () => {
    it('keeps only the query with the defaults', () => {
        expect(buildSearchHref(base)).toBe('/search?q=%D0%9E%D1%80%D0%B5%D0%BD%D0%B1%D1%83%D1%80%D0%B3')
    })

    it('applies a change', () => {
        expect(
            buildSearchHref({ ...base, q: 'a b' }, { categories: ['cave', 'castle'], sort: 'rating', type: 'places' })
        ).toBe('/search?q=a+b&type=places&category=cave%2Ccastle&sort=rating')
    })
})

describe('countFacets', () => {
    it('sums the chosen categories, or all', () => {
        const counts = { castle: 2, cave: 4, waterfall: 1 }

        expect(countFacets(counts, [])).toBe(7)
        expect(countFacets(counts, ['cave', 'waterfall'])).toBe(5)
        expect(countFacets(undefined, ['cave'])).toBe(0)
    })
})
