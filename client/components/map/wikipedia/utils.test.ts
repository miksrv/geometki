import Leaflet, { LatLngBounds } from 'leaflet'

import { ResponseGetExtract } from '@/api/apiWikipedia'

import { WIKIPEDIA_BASE_DOMAIN, WIKIPEDIA_COLOR } from './constants'
import { articleUrl, buildParams, createWikipediaIcon, extractArticle, truncateExtract } from './utils'

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
        expect(buildParams(mockBounds, 'ru').north).toBe(55.92)
    })

    it('returns correct south value', () => {
        expect(buildParams(mockBounds, 'ru').south).toBe(55.57)
    })

    it('returns correct east value', () => {
        expect(buildParams(mockBounds, 'ru').east).toBe(37.96)
    })

    it('returns correct west value', () => {
        expect(buildParams(mockBounds, 'ru').west).toBe(37.29)
    })

    it('includes locale in params', () => {
        expect(buildParams(mockBounds, 'ru').locale).toBe('ru')
    })

    it('returns all fields including locale', () => {
        expect(buildParams(mockBounds, 'en')).toStrictEqual({
            east: 37.96,
            locale: 'en',
            north: 55.92,
            south: 55.57,
            west: 37.29
        })
    })
})

describe('extractArticle', () => {
    it('returns the first page article', () => {
        const data: ResponseGetExtract = {
            query: {
                pages: {
                    '42': {
                        extract: 'Some article text.',
                        pageid: 42,
                        thumbnail: { height: 200, source: 'https://thumb.url/img.jpg', width: 300 },
                        title: 'Test Article'
                    }
                }
            }
        }
        expect(extractArticle(data)).toStrictEqual({
            extract: 'Some article text.',
            pageid: 42,
            thumbnail: { height: 200, source: 'https://thumb.url/img.jpg', width: 300 },
            title: 'Test Article'
        })
    })

    it('returns undefined when pages is empty', () => {
        const data: ResponseGetExtract = {
            query: { pages: {} }
        }
        expect(extractArticle(data)).toBeUndefined()
    })

    it('returns article without thumbnail when thumbnail is absent', () => {
        const data: ResponseGetExtract = {
            query: {
                pages: {
                    '7': {
                        extract: 'Short text.',
                        pageid: 7,
                        title: 'No Thumb'
                    }
                }
            }
        }
        expect(extractArticle(data)).toStrictEqual({
            extract: 'Short text.',
            pageid: 7,
            title: 'No Thumb'
        })
    })

    it('returns article without extract when extract is absent', () => {
        const data: ResponseGetExtract = {
            query: {
                pages: {
                    '8': {
                        pageid: 8,
                        title: 'No Extract'
                    }
                }
            }
        }
        expect(extractArticle(data)).toStrictEqual({
            pageid: 8,
            title: 'No Extract'
        })
    })
})

describe('truncateExtract', () => {
    it('returns text unchanged when shorter than maxChars', () => {
        expect(truncateExtract('Short text.', 50)).toBe('Short text.')
    })

    it('returns text unchanged when exactly maxChars length', () => {
        const text = 'a'.repeat(50)
        expect(truncateExtract(text, 50)).toBe(text)
    })

    it('truncates text and appends ellipsis when longer than maxChars', () => {
        const text = 'a'.repeat(100)
        const result = truncateExtract(text, 50)
        expect(result).toBe('a'.repeat(50) + '…')
    })

    it('handles empty string', () => {
        expect(truncateExtract('', 50)).toBe('')
    })

    it('handles maxChars of zero', () => {
        expect(truncateExtract('hello', 0)).toBe('…')
    })
})

describe('createWikipediaIcon', () => {
    beforeEach(() => jest.clearAllMocks())

    it('calls divIcon with correct iconSize', () => {
        createWikipediaIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconSize: [28, 28] }))
    })

    it('calls divIcon with correct iconAnchor', () => {
        createWikipediaIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [14, 14] }))
    })

    it('uses WIKIPEDIA_COLOR when not loading', () => {
        createWikipediaIcon(false)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(WIKIPEDIA_COLOR)
    })

    it('uses grey color when loading', () => {
        createWikipediaIcon(true)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('#999')
    })

    it('uses WIKIPEDIA_COLOR when loading is undefined', () => {
        createWikipediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(WIKIPEDIA_COLOR)
    })

    it('includes book SVG structure — rect for cover', () => {
        createWikipediaIcon()
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('<rect')
    })

    it('includes book SVG structure — lines for pages', () => {
        createWikipediaIcon()
        const html = String(mockDivIcon.mock.calls[0][0].html)
        const rectCount = (html.match(/<rect/g) ?? []).length
        expect(rectCount).toBeGreaterThan(1)
    })
})

describe('articleUrl', () => {
    it('returns correct URL for a simple title', () => {
        expect(articleUrl('Paris', 'en')).toBe(`https://en.${WIKIPEDIA_BASE_DOMAIN}/wiki/Paris`)
    })

    it('replaces spaces with underscores', () => {
        expect(articleUrl('Eiffel Tower', 'en')).toBe(`https://en.${WIKIPEDIA_BASE_DOMAIN}/wiki/Eiffel_Tower`)
    })

    it('uses the correct locale subdomain', () => {
        expect(articleUrl('Оренбург', 'ru')).toBe(
            `https://ru.${WIKIPEDIA_BASE_DOMAIN}/wiki/%D0%9E%D1%80%D0%B5%D0%BD%D0%B1%D1%83%D1%80%D0%B3`
        )
    })

    it('handles empty string', () => {
        expect(articleUrl('', 'en')).toBe(`https://en.${WIKIPEDIA_BASE_DOMAIN}/wiki/`)
    })

    it('preserves existing underscores', () => {
        expect(articleUrl('New_York', 'en')).toBe(`https://en.${WIKIPEDIA_BASE_DOMAIN}/wiki/New_York`)
    })
})
