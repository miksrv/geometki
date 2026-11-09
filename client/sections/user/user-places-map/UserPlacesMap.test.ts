import { ApiModel } from '@/api'

import { mergeUserPlaces } from './UserPlacesMap'

jest.mock('@/api', () => ({ API: {} }))
jest.mock('@/components/shared', () => ({}))
jest.mock('@/components/ui', () => ({}))

const mark = (id: string): ApiModel.PlaceMark => ({
    category: 'waterfall' as ApiModel.Categories,
    id,
    lat: 53,
    lon: 57
})

describe('mergeUserPlaces', () => {
    it('keeps one mark per place: visited first, then bookmarked, the own places plain', () => {
        const places = mergeUserPlaces({
            added: [mark('a'), mark('b'), mark('e')],
            bookmark: [mark('a'), mark('c'), mark('d')],
            visited: [mark('b'), mark('c')]
        })

        expect(places.map(({ id, tone }) => [id, tone])).toStrictEqual([
            ['b', 'visited'],
            ['c', 'visited'],
            ['a', 'bookmark'],
            ['d', 'bookmark'],
            ['e', undefined]
        ])
    })

    it('badges the places visited even when they are the only set', () => {
        expect(mergeUserPlaces({ added: [], bookmark: undefined, visited: [mark('v')] })).toStrictEqual([
            { ...mark('v'), tone: 'visited' }
        ])
    })

    it('takes the sets that have not loaded yet as empty', () => {
        expect(mergeUserPlaces({ added: undefined, bookmark: [mark('x')], visited: undefined })).toStrictEqual([
            { ...mark('x'), tone: 'bookmark' }
        ])
    })
})
