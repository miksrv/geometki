import Leaflet, { LatLngBounds } from 'leaflet'

import { MAX_YEAR, MIN_YEAR } from './constants'
import {
    buildParams,
    createClusterIcon,
    createDirectionIcon,
    createThumbnailIcon,
    photoToMark,
    yearToColor
} from './utils'

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

describe('yearToColor', () => {
    it('returns blue (hsl 240) for MIN_YEAR', () => {
        expect(yearToColor(MIN_YEAR)).toBe('hsl(240, 75%, 50%)')
    })

    it('returns green (hsl 120) for MAX_YEAR', () => {
        expect(yearToColor(MAX_YEAR)).toBe('hsl(120, 75%, 50%)')
    })

    it('defaults to MIN_YEAR color when year is undefined', () => {
        expect(yearToColor(undefined)).toBe(yearToColor(MIN_YEAR))
    })

    it('clamps years below MIN_YEAR', () => {
        expect(yearToColor(1000)).toBe(yearToColor(MIN_YEAR))
    })

    it('clamps years above MAX_YEAR', () => {
        expect(yearToColor(9999)).toBe(yearToColor(MAX_YEAR))
    })

    it('returns intermediate hue for mid-range year', () => {
        const midYear = Math.round((MIN_YEAR + MAX_YEAR) / 2)
        const color = yearToColor(midYear)
        const hue = parseInt(color.match(/hsl\((\d+)/)![1])
        expect(hue).toBeGreaterThanOrEqual(175)
        expect(hue).toBeLessThanOrEqual(185)
    })
})

describe('buildParams', () => {
    it('sets the correct zoom level', () => {
        expect(buildParams(mockBounds, 12).z).toBe(12)
    })

    it('builds a GeoJSON Polygon', () => {
        const result = buildParams(mockBounds, 10)
        expect(result.geometry.type).toBe('Polygon')
    })

    it('builds a closed polygon with 5 points', () => {
        const coords = buildParams(mockBounds, 10).geometry.coordinates[0]
        expect(coords).toHaveLength(5)
        expect(coords[0]).toStrictEqual(coords[4])
    })

    it('uses [lon, lat] order (GeoJSON standard)', () => {
        const coords = buildParams(mockBounds, 10).geometry.coordinates[0]
        expect(coords[0]).toStrictEqual([37.29, 55.57])
        expect(coords[2]).toStrictEqual([37.96, 55.92])
    })
})

describe('photoToMark', () => {
    it('constructs full and preview image URLs', () => {
        const result = photoToMark({ cid: 1, file: 'path/photo.jpg', geo: [51.77, 55.1] })
        expect(result.full).toBe('https://img.pastvu.com/a/path/photo.jpg')
        expect(result.preview).toBe('https://img.pastvu.com/h/path/photo.jpg')
    })

    it('maps geo to lat/lon', () => {
        const result = photoToMark({ cid: 1, file: 'x.jpg', geo: [51.77, 55.1] })
        expect(result.lat).toBe(51.77)
        expect(result.lon).toBe(55.1)
    })

    it('appends year to title when present', () => {
        const result = photoToMark({ cid: 1, file: 'x.jpg', geo: [0, 0], title: 'Old Street', year: 1960 })
        expect(result.title).toBe('Old Street (1960)')
    })

    it('shows title without year when year is absent', () => {
        const result = photoToMark({ cid: 1, file: 'x.jpg', geo: [0, 0], title: 'No Date' })
        expect(result.title).toBe('No Date')
    })

    it('handles missing title gracefully', () => {
        const result = photoToMark({ cid: 1, file: 'x.jpg', geo: [0, 0], year: 1900 })
        expect(result.title).toBe(' (1900)')
    })
})

describe('createDirectionIcon', () => {
    beforeEach(() => jest.clearAllMocks())

    it('calls divIcon with correct iconSize and iconAnchor', () => {
        createDirectionIcon()
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [16, 16], iconSize: [32, 32] }))
    })

    it('includes direction arrow polygon when dir is provided', () => {
        createDirectionIcon('n', 1960)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('polygon')
    })

    it('omits direction arrow when dir is undefined', () => {
        createDirectionIcon(undefined, 1960)
        expect(String(mockDivIcon.mock.calls[0][0].html)).not.toContain('polygon')
    })

    it('applies correct rotation for each compass direction', () => {
        const cases: Array<[string, number]> = [
            ['n', 0],
            ['ne', 45],
            ['e', 90],
            ['se', 135],
            ['s', 180],
            ['sw', 225],
            ['w', 270],
            ['nw', 315]
        ]

        for (const [dir, degrees] of cases) {
            jest.clearAllMocks()
            createDirectionIcon(dir)
            expect(String(mockDivIcon.mock.calls[0][0].html)).toContain(`rotate(${degrees}, 16, 16)`)
        }
    })

    it('is case-insensitive for direction strings', () => {
        createDirectionIcon('NW')
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('rotate(315, 16, 16)')
    })

    it('omits arrow for unrecognized direction string', () => {
        createDirectionIcon('unknown')
        expect(String(mockDivIcon.mock.calls[0][0].html)).not.toContain('polygon')
    })

    it('includes year-based color in SVG', () => {
        createDirectionIcon(undefined, MIN_YEAR)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('hsl(240, 75%, 50%)')
    })
})

describe('createThumbnailIcon', () => {
    beforeEach(() => jest.clearAllMocks())

    it('calls divIcon with correct iconSize and iconAnchor', () => {
        createThumbnailIcon('photo.jpg')
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [25, 16], iconSize: [50, 32] }))
    })

    it('includes thumbnail URL in html', () => {
        createThumbnailIcon('path/to/photo.jpg', 1970)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('https://img.pastvu.com/h/path/to/photo.jpg')
    })

    it('applies year-based border color', () => {
        createThumbnailIcon('photo.jpg', MIN_YEAR)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('border-color:hsl(240, 75%, 50%)')
    })
})

describe('createClusterIcon', () => {
    beforeEach(() => jest.clearAllMocks())

    it('calls divIcon with correct iconSize and iconAnchor', () => {
        createClusterIcon(5)
        expect(mockDivIcon).toHaveBeenCalledWith(expect.objectContaining({ iconAnchor: [16, 16], iconSize: [32, 32] }))
    })

    it('shows the count in html', () => {
        createClusterIcon(42)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('42')
    })

    it('shows "999+" when count exceeds 999', () => {
        createClusterIcon(1000)
        expect(String(mockDivIcon.mock.calls[0][0].html)).toContain('999+')
    })

    it('shows exact count at 999', () => {
        createClusterIcon(999)
        const html = String(mockDivIcon.mock.calls[0][0].html)
        expect(html).toContain('999')
        expect(html).not.toContain('999+')
    })
})
