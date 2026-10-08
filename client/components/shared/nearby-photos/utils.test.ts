import { buildLinksMap, buildNearbyPhotos, externalKey } from './utils'

const place = { lat: 51.4564, lon: 56.5967 }

const commons = {
    query: {
        pages: {
            '10': {
                coordinates: [{ lat: 51.4594, lon: 56.5967 }],
                imageinfo: [
                    {
                        thumburl: 'https://upload.wikimedia.org/commons/thumb/a/ab/Cave.jpg/1280px-Cave.jpg',
                        url: 'https://upload.wikimedia.org/commons/a/ab/Cave.jpg'
                    }
                ],
                index: 1,
                pageid: 10,
                title: 'File:Cave_entrance.jpg'
            }
        }
    }
}

const pastvu = {
    result: {
        photos: [{ cid: 77, file: 'a/b/c.jpg', geo: [51.4565, 56.5967] as [number, number], title: 'Вход', year: 1950 }]
    }
}

describe('buildNearbyPhotos', () => {
    it('merges both sources and sorts them by the distance from the place', () => {
        const photos = buildNearbyPhotos(place, commons, pastvu)

        expect(photos.map(({ key }) => key)).toStrictEqual(['pastvu:77', 'wikimedia:10'])
        expect(photos[0].distance).toBe(11)
        expect(photos[1].distance).toBe(334)
    })

    it('builds the PastVu image links and the title with the year', () => {
        const [photo] = buildNearbyPhotos(place, undefined, pastvu)

        expect(photo).toMatchObject({
            externalId: '77',
            full: 'https://img.pastvu.com/a/a/b/c.jpg',
            preview: 'https://img.pastvu.com/h/a/b/c.jpg',
            source: 'pastvu',
            title: 'Вход (1950)',
            year: 1950
        })
    })

    it('skips Commons files that are not pictures', () => {
        const audio = {
            query: {
                pages: {
                    '11': {
                        coordinates: [{ lat: 51.4565, lon: 56.5967 }],
                        imageinfo: [{ mediatype: 'AUDIO', url: 'https://upload.wikimedia.org/commons/a/ab/Echo.ogg' }],
                        pageid: 11,
                        title: 'File:Echo.ogg'
                    }
                }
            }
        }

        expect(buildNearbyPhotos(place, audio)).toStrictEqual([])
    })

    it('returns nothing without data', () => {
        expect(buildNearbyPhotos(place)).toStrictEqual([])
    })
})

describe('buildLinksMap', () => {
    it('maps the photo keys to the link ids', () => {
        const links = buildLinksMap([
            { externalId: '10', id: 'link1', source: 'wikimedia' },
            { externalId: '77', source: 'pastvu' }
        ])

        expect(links.get(externalKey('wikimedia', 10))).toBe('link1')
        expect(links.has(externalKey('pastvu', 77))).toBe(false)
    })
})
