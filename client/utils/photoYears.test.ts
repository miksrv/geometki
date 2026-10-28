import { ApiModel } from '@/api'

import { getPhotoYear, groupPhotosByYear } from './photoYears'

const photo = (id: string, created?: string, visitedAt?: string): ApiModel.Photo =>
    ({
        created: created ? { date: created } : undefined,
        full: '',
        height: 1,
        id,
        preview: '',
        visitedAt,
        width: 1
    }) as ApiModel.Photo

describe('photoYears', () => {
    it('takes the visit day before the upload day', () => {
        expect(getPhotoYear(photo('a', '2026-10-13 10:00:00', '2019-07-01'))).toBe(2019)
        expect(getPhotoYear(photo('b', '2026-10-13 10:00:00'))).toBe(2026)
        expect(getPhotoYear(photo('c'))).toBeUndefined()
    })

    it('does not group photos of one year', () => {
        expect(groupPhotosByYear([photo('a', '2026-01-01'), photo('b', '2026-05-05')])).toBeNull()
        expect(groupPhotosByYear([photo('a'), photo('b', '2026-05-05')])).toBeNull()
    })

    it('groups photos of several years, the latest first, keeping indexes', () => {
        const groups = groupPhotosByYear([
            photo('a', '2026-01-01'),
            photo('b', '2026-02-01', '2018-08-08'),
            photo('c', '2026-03-01'),
            photo('d')
        ])

        expect(groups?.map(({ year }) => year)).toEqual([2026, 2018, undefined])
        expect(groups?.[0].items.map(({ index }) => index)).toEqual([0, 2])
        expect(groups?.[1].items.map(({ photo: { id } }) => id)).toEqual(['b'])
    })
})
