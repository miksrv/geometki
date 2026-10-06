import { computeCollectionFacts, haversineDistanceKm } from './collectionFacts'

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

describe('computeCollectionFacts', () => {
    it('returns zeros for an empty/undefined list', () => {
        expect(computeCollectionFacts()).toStrictEqual({ placesCount: 0, photosCount: 0, routeLengthKm: 0 })
        expect(computeCollectionFacts([])).toStrictEqual({ placesCount: 0, photosCount: 0, routeLengthKm: 0 })
    })

    it('returns a zero route length for a single place', () => {
        const facts = computeCollectionFacts([{ lat: 55.75, lon: 37.62, photos: 3 }])
        expect(facts).toStrictEqual({ placesCount: 1, photosCount: 3, routeLengthKm: 0 })
    })

    it('sums photos and the route length across consecutive places', () => {
        const facts = computeCollectionFacts([
            { lat: 55.7558, lon: 37.6173, photos: 2 },
            { lat: 59.9343, lon: 30.3351, photos: 5 },
            { lat: 59.9343, lon: 30.3351, photos: 0 }
        ])

        expect(facts.placesCount).toBe(3)
        expect(facts.photosCount).toBe(7)
        expect(facts.routeLengthKm).toBeGreaterThan(600)
        expect(facts.routeLengthKm).toBeLessThan(660)
    })

    it('treats a missing photos count as zero', () => {
        const facts = computeCollectionFacts([{ lat: 0, lon: 0 }])
        expect(facts.photosCount).toBe(0)
    })
})
