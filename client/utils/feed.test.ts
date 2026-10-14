import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { FeedStory } from '@/api/models/feed'

import {
    buildCalendarWeeks,
    calendarLevel,
    calendarSummary,
    dayHeading,
    feedFilterTypes,
    flattenFeedPages,
    groupStoriesByDay,
    isFeedFilter,
    localDay,
    localToday
} from './feed'

import 'dayjs/locale/ru'

dayjs.extend(utc)

const story = (id: string, updated: string): FeedStory => ({
    count: 1,
    created: { date: updated, timezone: 'UTC', timezone_type: 3 },
    id,
    type: 'place',
    updated: { date: updated, timezone: 'UTC', timezone_type: 3 },
    weight: 3
})

describe('feed utilities', () => {
    describe('flattenFeedPages', () => {
        it('returns an empty list without pages', () => {
            expect(flattenFeedPages(undefined)).toStrictEqual([])
        })

        it('joins the pages in order', () => {
            const pages = [
                { items: [story('a', '2026-10-13 10:00:00')] },
                { items: [story('b', '2026-10-12 10:00:00')] }
            ]
            expect(flattenFeedPages(pages).map((item) => item.id)).toStrictEqual(['a', 'b'])
        })

        it('keeps a story that came again on a later page once, where it was first', () => {
            const pages = [
                { items: [story('a', '2026-10-13 10:00:00'), story('b', '2026-10-13 09:00:00')] },
                { items: [story('b', '2026-10-13 11:00:00'), story('c', '2026-10-12 10:00:00')] }
            ]
            expect(flattenFeedPages(pages).map((item) => item.id)).toStrictEqual(['a', 'b', 'c'])
        })
    })

    describe('groupStoriesByDay', () => {
        it('splits stories by the local day of their last event', () => {
            const days = groupStoriesByDay([
                story('a', dayjs().utc().format('YYYY-MM-DD HH:mm:ss')),
                story('b', '2020-01-02 12:00:00'),
                story('c', '2020-01-02 11:00:00'),
                story('d', '2020-01-01 12:00:00')
            ])

            expect(days.map((day) => day.stories.map((item) => item.id))).toStrictEqual([['a'], ['b', 'c'], ['d']])
            expect(days[0].date).toBe(localToday())
        })

        it('splits by the days of the given time zone', () => {
            // 03:30 UTC on the 14th is still the 13th in Los Angeles, already the 14th in Moscow
            const stories = [story('a', '2026-10-14 03:30:00'), story('b', '2026-10-13 22:00:00')]

            expect(groupStoriesByDay(stories, 'America/Los_Angeles').map((day) => day.date)).toStrictEqual([
                '2026-10-13'
            ])
            expect(groupStoriesByDay(stories).map((day) => day.date)).toStrictEqual(['2026-10-14'])
        })

        it('returns no days without stories', () => {
            expect(groupStoriesByDay([])).toStrictEqual([])
            expect(groupStoriesByDay(undefined)).toStrictEqual([])
        })
    })

    describe('localDay', () => {
        it('takes the day in Moscow time without a time zone, wherever the code runs', () => {
            // 22:30 UTC is 01:30 of the next day in Moscow
            expect(localDay('2026-10-13 22:30:00')).toBe('2026-10-14')
            expect(localDay('2026-10-13 20:59:59')).toBe('2026-10-13')
            expect(localDay(undefined)).toBe('')
        })

        it('takes the day in the given time zone', () => {
            // 23:24 UTC is 16:24 in Los Angeles (summer time) and 08:24 of the next day in Tokyo
            expect(localDay('2026-10-14 23:24:00', 'America/Los_Angeles')).toBe('2026-10-14')
            expect(localDay('2026-10-14 06:59:59', 'America/Los_Angeles')).toBe('2026-10-13')
            expect(localDay('2026-10-14 23:24:00', 'Asia/Tokyo')).toBe('2026-10-15')
        })
    })

    describe('dayHeading', () => {
        it('names today and yesterday', () => {
            expect(dayHeading('2026-10-13', '2026-10-13', 'ru')).toStrictEqual({ key: 'today' })
            expect(dayHeading('2026-10-12', '2026-10-13', 'ru')).toStrictEqual({ key: 'yesterday' })
        })

        it('writes an earlier day of this year without the year', () => {
            expect(dayHeading('2026-10-01', '2026-10-13', 'ru')).toStrictEqual({ text: '1 октября' })
            expect(dayHeading('2026-10-01', '2026-10-13', 'en')).toStrictEqual({ text: '1 October' })
        })

        it('adds the year to a day of another year', () => {
            expect(dayHeading('2025-12-31', '2026-01-05', 'en')).toStrictEqual({ text: '31 December 2025' })
        })
    })

    describe('calendarLevel', () => {
        it('is 0 for a day without events', () => {
            expect(calendarLevel(0, 10)).toBe(0)
            expect(calendarLevel(3, 0)).toBe(0)
        })

        it('splits the busiest day into quartiles', () => {
            expect(calendarLevel(1, 8)).toBe(1)
            expect(calendarLevel(2, 8)).toBe(1)
            expect(calendarLevel(3, 8)).toBe(2)
            expect(calendarLevel(6, 8)).toBe(3)
            expect(calendarLevel(8, 8)).toBe(4)
        })
    })

    describe('buildCalendarWeeks', () => {
        it('starts the first week on Monday and pads it with days outside the range', () => {
            // 2026-10-01 is a Thursday
            const weeks = buildCalendarWeeks([], '2026-10-01', '2026-10-04', 1)

            expect(weeks).toHaveLength(1)
            expect(weeks[0][0].date).toBe('2026-09-28')
            expect(weeks[0][0].outside).toBe(true)
            expect(weeks[0][3]).toMatchObject({ date: '2026-10-01', outside: false })
            expect(weeks[0][6]).toMatchObject({ date: '2026-10-04', outside: false })
        })

        it('starts the week on Sunday when asked', () => {
            const weeks = buildCalendarWeeks([], '2026-10-01', '2026-10-01', 0)

            expect(weeks[0][0].date).toBe('2026-09-27')
        })

        it('marks the days after the last one as outside', () => {
            const weeks = buildCalendarWeeks([], '2026-10-05', '2026-10-07', 1)

            expect(weeks[0][2]).toMatchObject({ date: '2026-10-07', outside: false })
            expect(weeks[0][3]).toMatchObject({ date: '2026-10-08', outside: true })
        })

        it('puts the counts and their levels on their days', () => {
            const weeks = buildCalendarWeeks(
                [
                    { count: 4, date: '2026-10-06' },
                    { count: 1, date: '2026-10-07' }
                ],
                '2026-10-05',
                '2026-10-11',
                1
            )

            expect(weeks[0][1]).toMatchObject({ count: 4, level: 4 })
            expect(weeks[0][2]).toMatchObject({ count: 1, level: 1 })
            expect(weeks[0][0]).toMatchObject({ count: 0, level: 0 })
        })

        it('covers a year in 53 or 54 weeks', () => {
            const weeks = buildCalendarWeeks([], '2025-10-14', '2026-10-13', 1)

            expect(weeks.length).toBeGreaterThanOrEqual(53)
            expect(weeks.length).toBeLessThanOrEqual(54)
            expect(weeks.every((week) => week.length === 7)).toBe(true)
        })
    })

    describe('filters', () => {
        it('recognises the filters of the feed page', () => {
            expect(isFeedFilter('photos')).toBe(true)
            expect(isFeedFilter('toString')).toBe(false)
            expect(isFeedFilter(undefined)).toBe(false)
        })

        it('turns a filter into story types', () => {
            expect(feedFilterTypes('collections')).toBe('collection,collection_place')
            expect(feedFilterTypes(undefined)).toBeUndefined()
        })
    })
})

describe('calendarSummary', () => {
    const days = [
        { count: 2, date: '2026-10-01' },
        { count: 5, date: '2026-10-02' },
        { count: 1, date: '2026-10-03' },
        { count: 3, date: '2026-10-07' },
        { count: 1, date: '2026-10-08' }
    ]

    it('adds up the events and the active days', () => {
        const summary = calendarSummary(days, '2026-10-13')

        expect(summary.total).toBe(12)
        expect(summary.activeDays).toBe(5)
        expect(summary.busiestDay).toStrictEqual({ count: 5, date: '2026-10-02' })
    })

    it('finds the longest run of days in a row', () => {
        expect(calendarSummary(days, '2026-10-13').longestStreak).toBe(3)
    })

    it('counts the current run up to today', () => {
        expect(calendarSummary(days, '2026-10-08').currentStreak).toBe(2)
    })

    it('keeps the current run while today is still empty', () => {
        expect(calendarSummary(days, '2026-10-09').currentStreak).toBe(2)
    })

    it('has no current run after a missed day', () => {
        expect(calendarSummary(days, '2026-10-10').currentStreak).toBe(0)
    })

    it('handles an empty year', () => {
        expect(calendarSummary([], '2026-10-13')).toStrictEqual({
            activeDays: 0,
            busiestDay: undefined,
            currentStreak: 0,
            longestStreak: 0,
            total: 0
        })
    })
})
