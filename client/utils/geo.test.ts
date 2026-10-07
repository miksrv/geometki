import { haversineDistanceKm } from './geo'

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
