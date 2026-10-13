import { getDistanceOrigin, getUserLocationFromCookies, parseUserLocation, roundLocation } from './userLocation'

describe('userLocation', () => {
    it('rounds to 3 decimal places', () => {
        expect(roundLocation(55.123456, 37.987654)).toStrictEqual({ lat: 55.123, lon: 37.988 })
    })

    it('parses the cookie value', () => {
        expect(parseUserLocation('51.765;55.1')).toStrictEqual({ lat: 51.765, lon: 55.1 })
    })

    it.each([undefined, null, '', 'abc', '51.7', ';55.1', '91;10', '10;181', '0;0'])('rejects %p', (value) => {
        expect(parseUserLocation(value)).toBeUndefined()
    })

    it('reads the location from the request cookies', () => {
        expect(getUserLocationFromCookies({ location: '51.765;55.1' })).toStrictEqual({ lat: 51.765, lon: 55.1 })
        expect(getUserLocationFromCookies({})).toBeUndefined()
    })

    it('prefers the point from the URL over the visitor location', () => {
        const cookies = { location: '51.765;55.1' }

        expect(getDistanceOrigin(40, 50, cookies)).toStrictEqual({ lat: 40, lon: 50 })
        expect(getDistanceOrigin(null, null, cookies)).toStrictEqual({ lat: 51.765, lon: 55.1 })
    })
})
