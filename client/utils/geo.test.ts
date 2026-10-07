import { formatArea, formatDistance, geodesicArea, haversineDistanceKm } from './geo'

describe('haversineDistanceKm', () => {
    it('returns 0 for identical points', () => {
        expect(haversineDistanceKm({ lat: 55.75, lon: 37.62 }, { lat: 55.75, lon: 37.62 })).toBe(0)
    })

    it('returns the approximate distance between Moscow and Saint Petersburg', () => {
        const moscow = { lat: 55.7558, lon: 37.6173 }
        const spb = { lat: 59.9343, lon: 30.3351 }

        const distance = haversineDistanceKm(moscow, spb)

        // Real-world great-circle distance is ~635 km
        expect(distance).toBeGreaterThan(600)
        expect(distance).toBeLessThan(660)
    })
})

describe('formatDistance', () => {
    it('shows metres below one kilometre', () => {
        expect(formatDistance(0)).toBe('0 м')
        expect(formatDistance(849.6)).toBe('850 м')
        expect(formatDistance(999.4, 'en')).toBe('999 m')
    })

    it('switches to kilometres when metres round up to 1000', () => {
        expect(formatDistance(999.6)).toBe('1,00 км')
    })

    it('shows kilometres with less precision as they grow', () => {
        expect(formatDistance(1250)).toBe('1,25 км')
        expect(formatDistance(12_440)).toBe('12,4 км')
        expect(formatDistance(340_400)).toBe('340 км')
    })

    it('uses English units and separators for the English locale', () => {
        expect(formatDistance(1250, 'en')).toBe('1.25 km')
        expect(formatDistance(1_234_000, 'en')).toBe('1,234 km')
    })
})

describe('geodesicArea', () => {
    it('returns 0 for fewer than three points', () => {
        expect(geodesicArea([])).toBe(0)
        expect(
            geodesicArea([
                { lat: 0, lng: 0 },
                { lat: 0, lng: 1 }
            ])
        ).toBe(0)
    })

    it('returns the area of a one-degree square at the equator (~12 364 km²)', () => {
        const square = [
            { lat: 0, lng: 0 },
            { lat: 0, lng: 1 },
            { lat: 1, lng: 1 },
            { lat: 1, lng: 0 }
        ]
        const area = geodesicArea(square) / 1_000_000

        expect(area).toBeGreaterThan(12_300)
        expect(area).toBeLessThan(12_400)
    })

    it('does not depend on the direction the points go in', () => {
        const triangle = [
            { lat: 55, lng: 37 },
            { lat: 55, lng: 38 },
            { lat: 56, lng: 37 }
        ]

        expect(geodesicArea(triangle)).toBeCloseTo(geodesicArea([...triangle].reverse()))
    })
})

describe('formatArea', () => {
    it('shows square metres below one hectare', () => {
        expect(formatArea(0)).toBe('0 м²')
        expect(formatArea(849.6)).toBe('850 м²')
        expect(formatArea(9_850, 'en')).toBe('9,850 m²')
    })

    it('shows hectares below one square kilometre', () => {
        expect(formatArea(12_500)).toBe('1,25 га')
        expect(formatArea(456_000)).toBe('45,6 га')
        expect(formatArea(12_500, 'en')).toBe('1.25 ha')
    })

    it('switches units when the value rounds up to the next one', () => {
        expect(formatArea(9_999.7)).toBe('1,00 га')
        expect(formatArea(999_960)).toBe('1,00 км²')
    })

    it('shows square kilometres from one square kilometre', () => {
        expect(formatArea(1_250_000)).toBe('1,25 км²')
        expect(formatArea(340_400_000)).toBe('340 км²')
        expect(formatArea(1_234_000_000, 'en')).toBe('1,234 km²')
    })
})
