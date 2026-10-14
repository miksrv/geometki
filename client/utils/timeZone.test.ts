import { getTimeZoneFromCookies, isTimeZone, TIME_ZONE_COOKIE, zonedDay } from './timeZone'

describe('timeZone', () => {
    describe('isTimeZone', () => {
        it('accepts IANA zone names', () => {
            expect(isTimeZone('Europe/Moscow')).toBe(true)
            expect(isTimeZone('America/Los_Angeles')).toBe(true)
            expect(isTimeZone('UTC')).toBe(true)
        })

        it('rejects anything else', () => {
            expect(isTimeZone(undefined)).toBe(false)
            expect(isTimeZone('')).toBe(false)
            expect(isTimeZone('Mars/Olympus')).toBe(false)
            expect(isTimeZone('Europe/Moscow; drop')).toBe(false)
        })
    })

    describe('getTimeZoneFromCookies', () => {
        it('reads a valid zone and ignores an invalid one', () => {
            expect(getTimeZoneFromCookies({ [TIME_ZONE_COOKIE]: 'Asia/Tokyo' })).toBe('Asia/Tokyo')
            expect(getTimeZoneFromCookies({ [TIME_ZONE_COOKIE]: 'nowhere' })).toBeUndefined()
            expect(getTimeZoneFromCookies({})).toBeUndefined()
        })
    })

    describe('zonedDay', () => {
        it('gives the day of a moment in the zone', () => {
            const moment = new Date('2026-10-14T23:24:00Z')

            expect(zonedDay(moment, 'America/Los_Angeles')).toBe('2026-10-14')
            expect(zonedDay(moment, 'Europe/Moscow')).toBe('2026-10-15')
        })

        it('follows daylight saving time', () => {
            // Los Angeles is UTC−8 in winter: 07:30 UTC is still the previous day
            expect(zonedDay(new Date('2026-01-15T07:30:00Z'), 'America/Los_Angeles')).toBe('2026-01-14')
            expect(zonedDay(new Date('2026-07-15T07:30:00Z'), 'America/Los_Angeles')).toBe('2026-07-15')
        })
    })
})
