import Leaflet, { LatLngBounds } from 'leaflet'

import { ResponseGetImageInfo } from '@/api/apiWikimediaCommons'

import { WIKIMEDIA_COMMONS_COLOR } from './constants'
import { buildParams, cleanTitle, createWikimediaIcon, extractImageInfo } from './utils'

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
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconSize: [28, 28] }))
    })

    it('calls divIcon with correct iconAnchor', () => {
        createWikimediaIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [14, 14] }))
    })

    it('uses WIKIMEDIA_COMMONS_COLOR when not loading', () => {
        createWikimediaIcon(false)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(WIKIMEDIA_COMMONS_COLOR)
    })

    it('uses grey color when loading', () => {
        createWikimediaIcon(true)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('#999')
    })

    it('uses WIKIMEDIA_COMMONS_COLOR when loading is undefined', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(WIKIMEDIA_COMMONS_COLOR)
    })

    it('includes camera SVG structure — rect for body', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('<rect')
    })

    it('includes camera SVG structure — circle for lens', () => {
        createWikimediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('<circle')
    })
})

describe('extractImageInfo', () => {
    it('returns imageinfo from the first page', () => {
        const data: ResponseGetImageInfo = {
            query: {
                pages: {
                    '123': {
                        imageinfo: [
                            {
                                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
                                thumburl: 'https://thumb.url/Test.jpg',
                                url: 'https://url.com/Test.jpg'
                            }
                        ],
                        pageid: 123,
                        title: 'File:Test.jpg'
                    }
                }
            }
        }
        expect(extractImageInfo(data)).toStrictEqual({
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
            thumburl: 'https://thumb.url/Test.jpg',
            url: 'https://url.com/Test.jpg'
        })
    })

    it('returns undefined when imageinfo is absent', () => {
        const data: ResponseGetImageInfo = {
            query: {
                pages: {
                    '-1': {
                        pageid: -1,
                        title: 'File:Missing.jpg'
                    }
                }
            }
        }
        expect(extractImageInfo(data)).toBeUndefined()
    })

    it('returns undefined when pages is empty', () => {
        const data: ResponseGetImageInfo = {
            query: { pages: {} }
        }
        expect(extractImageInfo(data)).toBeUndefined()
    })

    it('returns undefined when imageinfo array is empty', () => {
        const data: ResponseGetImageInfo = {
            query: {
                pages: {
                    '1': {
                        imageinfo: [],
                        pageid: 1,
                        title: 'File:Empty.jpg'
                    }
                }
            }
        }
        expect(extractImageInfo(data)).toBeUndefined()
    })
})
