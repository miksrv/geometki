import Leaflet, { LatLngBounds } from 'leaflet'

import { ResponseGetByBounds } from '@/api/apiWikimediaCommons'

import { WIKIMEDIA_COMMONS_COLOR } from './constants'
import { buildParams, cleanTitle, createWikimediaIcon, extractPhotoMarks, resizeThumbUrl } from './utils'

jest.mock('leaflet', () => ({
    divIcon: jest.fn().mockReturnValue({})
}))

const mockDivIcon = jest.mocked(Leaflet.divIcon)

const mockBounds = {
    getEast: () => 37.96,
    getNorth: () => 55.92,
    getSouth: () => 55.57,
    getWest: () => 37.29
} as unknown as LatLngBounds

describe('buildParams', () => {
    it('returns correct north value', () => {
        expect(buildParams(mockBounds).north).toBe(55.92)
    })

    it('returns correct south value', () => {
        expect(buildParams(mockBounds).south).toBe(55.57)
    })

    it('returns correct east value', () => {
        expect(buildParams(mockBounds).east).toBe(37.96)
    })

    it('returns correct west value', () => {
        expect(buildParams(mockBounds).west).toBe(37.29)
    })

    it('returns all four bounds fields', () => {
        expect(buildParams(mockBounds)).toStrictEqual({
            east: 37.96,
            north: 55.92,
            south: 55.57,
            west: 37.29
        })
    })
})

describe('cleanTitle', () => {
    it('removes "File:" prefix', () => {
        expect(cleanTitle('File:Example.jpg')).toBe('Example.jpg')
    })

    it('replaces underscores with spaces', () => {
        expect(cleanTitle('File:My_Cool_Photo.jpg')).toBe('My Cool Photo.jpg')
    })

    it('handles title without File: prefix', () => {
        expect(cleanTitle('NoPrefix_title.jpg')).toBe('NoPrefix title.jpg')
    })

    it('handles title with no underscores', () => {
        expect(cleanTitle('File:Plain.jpg')).toBe('Plain.jpg')
    })

    it('handles empty string', () => {
        expect(cleanTitle('')).toBe('')
    })
})

describe('createWikimediaIcon', () => {
    beforeEach(() => jest.clearAllMocks())

    it('calls divIcon with correct iconSize', () => {
        createWikimediaIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconSize: [20, 20] }))
    })

    it('calls divIcon with correct iconAnchor', () => {
        createWikimediaIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [10, 10] }))
    })

    it('uses WIKIMEDIA_COMMONS_COLOR', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(WIKIMEDIA_COMMONS_COLOR)
    })

    it('includes camera SVG structure — rect for background and body', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('<rect')
    })

    it('includes camera SVG structure — circle for lens', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('<circle')
    })
})

const THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Big.jpg/1280px-Big.jpg?utm_source=x'
const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Small.jpg?utm_source=x'

describe('resizeThumbUrl', () => {
    it('replaces the width of a thumbnail', () => {
        expect(resizeThumbUrl(THUMB, 330)).toBe(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Big.jpg/330px-Big.jpg?utm_source=x'
        )
    })

    it('keeps a link to the original as is', () => {
        expect(resizeThumbUrl(ORIGINAL, 330)).toBe(ORIGINAL)
    })
})

describe('extractPhotoMarks', () => {
    const data: ResponseGetByBounds = {
        query: {
            pages: {
                '1': {
                    coordinates: [{ lat: 55.75, lon: 37.61 }],
                    imageinfo: [
                        { height: 888, thumburl: THUMB, thumbwidth: 1280, url: 'https://x/Big.jpg', width: 1500 }
                    ],
                    index: 1,
                    pageid: 1,
                    title: 'File:Big_photo.jpg'
                },
                '2': {
                    coordinates: [{ lat: 55.76, lon: 37.62 }],
                    imageinfo: [{ height: 1357, thumburl: ORIGINAL, thumbwidth: 1280, url: ORIGINAL, width: 1000 }],
                    index: -1,
                    pageid: 2,
                    title: 'File:Small_photo.jpg'
                },
                '3': {
                    imageinfo: [{ url: 'https://x/NoCoords.jpg' }],
                    index: 0,
                    pageid: 3,
                    title: 'File:No_coords.jpg'
                },
                '4': {
                    coordinates: [{ lat: 55.7, lon: 37.6 }],
                    index: 2,
                    pageid: 4,
                    title: 'File:No_info.jpg'
                }
            }
        }
    }

    it('keeps only files with coordinates and an image, in the geosearch order', () => {
        expect(extractPhotoMarks(data).map(({ pageid }) => pageid)).toStrictEqual([2, 1])
    })

    it('builds a photo mark of the thumbnail', () => {
        expect(extractPhotoMarks(data)[1]).toStrictEqual({
            full: THUMB,
            height: 758,
            lat: 55.75,
            lon: 37.61,
            pageid: 1,
            preview: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Big.jpg/330px-Big.jpg?utm_source=x',
            title: 'Big photo.jpg',
            width: 1280
        })
    })

    it('does not take the size of a small original for bigger than it is', () => {
        const [mark] = extractPhotoMarks(data)
        expect(mark).toEqual(expect.objectContaining({ full: ORIGINAL, height: 1357, preview: ORIGINAL, width: 1000 }))
    })

    it('returns an empty list without data', () => {
        expect(extractPhotoMarks(undefined)).toStrictEqual([])
        expect(extractPhotoMarks({})).toStrictEqual([])
    })
})
