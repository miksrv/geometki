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
    it('keeps one mark per place, toned by the first set it is in', () => {
        const places = mergeUserPlaces({
            added: [mark('a'), mark('b')],
            bookmark: [mark('a'), mark('c'), mark('d')],
            visited: [mark('b'), mark('c')]
        })

        expect(places.map(({ id, tone }) => [id, tone])).toStrictEqual([
            ['a', 'added'],
            ['b', 'added'],
            ['c', 'visited'],
            ['d', 'bookmark']
        ])
    })

    it('takes the sets that have not loaded yet as empty', () => {
        expect(mergeUserPlaces({ added: undefined, bookmark: [mark('x')], visited: undefined })).toStrictEqual([
            { ...mark('x'), tone: 'bookmark' }
        ])
    })
})
