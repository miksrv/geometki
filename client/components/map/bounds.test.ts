import type { LatLngBounds } from 'leaflet'

import { boundsAreaMeters, isGeoSearchTooBig, roundBoundsOutwards } from './bounds'

const bounds = (south: number, west: number, north: number, east: number): LatLngBounds =>
    ({
        getEast: () => east,
        getNorth: () => north,
        getSouth: () => south,
        getWest: () => west
    }) as LatLngBounds

describe('roundBoundsOutwards', () => {
    it('rounds the south-west corner down and the north-east corner up', () => {
        expect(roundBoundsOutwards(bounds(51.123, 54.956, 51.181, 55.041))).toEqual([51.12, 54.95, 51.19, 55.05])
    })

    it('keeps values that are already on the grid', () => {
        expect(roundBoundsOutwards(bounds(51.12, 54.95, 51.18, 55.05))).toEqual([51.12, 54.95, 51.18, 55.05])
    })

    it('rounds negative coordinates outwards too', () => {
        expect(roundBoundsOutwards(bounds(-33.876, -70.654, -33.401, -70.501))).toEqual([-33.88, -70.66, -33.4, -70.5])
    })
})

describe('boundsAreaMeters', () => {
    it('measures a 0.1° square at the equator as about 11 × 11 km', () => {
        const area = boundsAreaMeters(bounds(0, 0, 0.1, 0.1))

        expect(area / 1e6).toBeCloseTo(123.6, 0)
    })

    it('shrinks the width with the latitude', () => {
        const equator = boundsAreaMeters(bounds(0, 0, 0.1, 0.1))
        const north = boundsAreaMeters(bounds(60, 0, 60.1, 0.1))

        expect(north / equator).toBeCloseTo(Math.cos((60.05 * Math.PI) / 180), 2)
    })
})

describe('isGeoSearchTooBig', () => {
    it('accepts a city district', () => {
        // About 6.7 × 6.3 km in Moscow
        expect(isGeoSearchTooBig(bounds(55.7, 37.55, 55.76, 37.65))).toBe(false)
    })

    it('accepts an area just below 20 × 20 km', () => {
        // 0.17° of latitude is 18.9 km; 0.3° of longitude at 55.8° is 18.8 km
        expect(isGeoSearchTooBig(bounds(55.7, 37.4, 55.87, 37.7))).toBe(false)
    })

    it('rejects a whole city', () => {
        // About 39 × 42 km
        expect(isGeoSearchTooBig(bounds(55.57, 37.29, 55.92, 37.96))).toBe(true)
    })
})
