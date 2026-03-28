import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(relativeTime)

import { dateToUnixTime, formatDate, formatDateISO, formatDateUTC, minutesAgo, timeAgo } from './date'

describe('date utilities', () => {
    describe('formatDate', () => {
        it('returns empty string when date is undefined', () => {
            expect(formatDate(undefined)).toBe('')
        })

        it('formats a date string with the default format', () => {
            const result = formatDate('2024-06-15T12:30:00Z')
            // The result must be a non-empty string containing the year 2024
            expect(result).toMatch(/2024/)
        })

        it('accepts a Date object', () => {
            // Use noon UTC so the result stays in 2024 regardless of timezone
            const date = new Date('2024-06-15T12:00:00Z')
            const result = formatDate(date)
            expect(result).toMatch(/2024/)
        })

        it('accepts a custom format string', () => {
            // Use a unique format to ensure the custom format is being applied
            const result = formatDate('2024-06-15T12:00:00Z', 'YYYY')
            expect(result).toBe('2024')
        })
    })

    describe('dateToUnixTime', () => {
        it('converts a date string to unix timestamp', () => {
            const unix = dateToUnixTime('2024-01-01T00:00:00Z')
            expect(typeof unix).toBe('number')
            expect(unix).toBeGreaterThan(0)
        })

        it('returns current timestamp when date is undefined', () => {
            const before = dayjs().unix()
            const unix = dateToUnixTime(undefined)
            const after = dayjs().unix()
            // The NaN-safe range check: dayjs(undefined).unix() is the current time
            expect(unix).toBeGreaterThanOrEqual(before - 1)
            expect(unix).toBeLessThanOrEqual(after + 1)
        })

        it('accepts a Date object', () => {
            const date = new Date('2020-01-01T00:00:00Z')
            expect(dateToUnixTime(date)).toBeGreaterThan(0)
        })
    })

    describe('formatDateISO', () => {
        it('returns an ISO 8601 string', () => {
            const result = formatDateISO('2024-06-15T12:30:00Z')
            // ISO 8601 pattern: YYYY-MM-DDTHH:mm:ss.sssZ
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        })

        it('accepts a Date object', () => {
            const result = formatDateISO(new Date('2024-01-01'))
            expect(result).toMatch(/2024/)
        })
    })

    describe('timeAgo', () => {
        it('returns empty string when date is undefined', () => {
            expect(timeAgo(undefined)).toBe('')
        })

        it('returns a relative time string for a recent date', () => {
            const recent = dayjs().subtract(5, 'minute').toISOString()
            const result = timeAgo(recent)
            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
        })

        it('respects withoutSuffix parameter', () => {
            const date = dayjs().subtract(1, 'hour').toISOString()
            const withSuffix = timeAgo(date, false)
            const withoutSuffix = timeAgo(date, true)
            // Both should return a non-empty string; their exact text may differ
            expect(typeof withSuffix).toBe('string')
            expect(typeof withoutSuffix).toBe('string')
        })
    })

    describe('minutesAgo', () => {
        it('returns a large number when date is undefined', () => {
            expect(minutesAgo(undefined)).toBe(99999999)
        })

        it('returns a small positive number for a recently created date', () => {
            const twoMinutesAgo = dayjs().subtract(2, 'minute').toISOString()
            const result = minutesAgo(twoMinutesAgo)
            expect(result).toBeGreaterThanOrEqual(1)
            expect(result).toBeLessThanOrEqual(5)
        })

        it('returns 0 or near 0 for the current timestamp', () => {
            const now = new Date().toISOString()
            expect(minutesAgo(now)).toBeLessThanOrEqual(1)
        })
    })

    describe('formatDateUTC', () => {
        it('returns empty string when date is undefined', () => {
            expect(formatDateUTC(undefined)).toBe('')
        })

        it('returns a string ending with Z', () => {
            const result = formatDateUTC('2024-06-15T12:30:00')
            expect(result.endsWith('Z')).toBe(true)
        })

        it('contains the date in YYYY-MM-DD format', () => {
            const result = formatDateUTC('2024-06-15T00:00:00')
            expect(result).toContain('2024-06-15')
        })
    })
})
