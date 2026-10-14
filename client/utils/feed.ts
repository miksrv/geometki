import dayjs from 'dayjs'

import { FeedStory, FeedStoryTypes } from '@/api/models/feed'
import { CalendarDay, ListResponse } from '@/api/types/feed'
import { SITE_TIME_ZONE, zonedDay } from '@/utils/timeZone'

/** Stories of one local day, newest first */
export type FeedDay = {
    /** YYYY-MM-DD in the viewer's time zone */
    date: string
    stories: FeedStory[]
}

/** One cell of the contribution calendar */
export type CalendarCell = {
    /** YYYY-MM-DD */
    date: string
    count: number
    /** 0 — nothing, 1…4 — quartiles of the busiest day */
    level: 0 | 1 | 2 | 3 | 4
    /** Outside the year shown (the padding of the first and the last week) */
    outside: boolean
}

/** The day in the viewer's time zone (utils/timeZone.ts) of a server (UTC) time */
export const localDay = (date?: string, timeZone: string = SITE_TIME_ZONE): string =>
    date ? zonedDay(dayjs.utc(date).toDate(), timeZone) : ''

/** Today in the viewer's time zone */
export const localToday = (timeZone: string = SITE_TIME_ZONE): string => zonedDay(new Date(), timeZone)

/**
 * The stories of all loaded pages as one list. A story that grew while the reader
 * scrolled moves up and may come again on a later page: it is kept once, where it was
 * first seen.
 */
export const flattenFeedPages = (pages?: ListResponse[]): FeedStory[] => {
    const seen = new Set<string>()
    const stories: FeedStory[] = []

    pages?.forEach((page) =>
        page.items.forEach((story) => {
            if (!seen.has(story.id)) {
                seen.add(story.id)
                stories.push(story)
            }
        })
    )

    return stories
}

/** Stories split into days (of the viewer's time zone) by their last event, keeping the order */
export const groupStoriesByDay = (stories?: FeedStory[], timeZone?: string): FeedDay[] => {
    const days: FeedDay[] = []

    stories?.forEach((story) => {
        const date = localDay(story.updated?.date, timeZone)
        const last = days[days.length - 1]

        if (last?.date === date) {
            last.stories.push(story)
        } else {
            days.push({ date, stories: [story] })
        }
    })

    return days
}

/**
 * Heading of a day of the feed: "today" / "yesterday" keys for the last two days, else
 * the date, with the year only when it is not the current one.
 *
 * @param date  YYYY-MM-DD
 * @param today YYYY-MM-DD, the viewer's today
 */
export const dayHeading = (
    date: string,
    today: string,
    locale: string
): { key: 'today' | 'yesterday' } | { text: string } => {
    if (date === today) {
        return { key: 'today' }
    }

    if (date === dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')) {
        return { key: 'yesterday' }
    }

    const day = dayjs(date).locale(locale)

    return { text: day.format(day.year() === dayjs(today).year() ? 'D MMMM' : 'D MMMM YYYY') }
}

/**
 * Activity level of a day for the calendar colour: quartiles of the busiest day, so a
 * quiet year still shows its pattern.
 */
export const calendarLevel = (count: number, max: number): CalendarCell['level'] => {
    if (count <= 0 || max <= 0) {
        return 0
    }

    return Math.min(4, Math.ceil((count / max) * 4)) as CalendarCell['level']
}

/**
 * The calendar as weeks (columns) of seven days (rows), from the week of `from` to the
 * week of `to`. `weekStart` is 1 for Monday (ru), 0 for Sunday (en).
 */
export const buildCalendarWeeks = (
    items: CalendarDay[],
    from: string,
    to: string,
    weekStart: 0 | 1 = 1
): CalendarCell[][] => {
    const counts = new Map(items.map((item) => [item.date, item.count]))
    const max = items.reduce((result, item) => Math.max(result, item.count), 0)

    const first = dayjs(from)
    const last = dayjs(to)
    const start = first.subtract((first.day() - weekStart + 7) % 7, 'day')

    const weeks: CalendarCell[][] = []

    for (let day = start; !day.isAfter(last); day = day.add(7, 'day')) {
        const week: CalendarCell[] = []

        for (let i = 0; i < 7; i++) {
            const cell = day.add(i, 'day')
            const date = cell.format('YYYY-MM-DD')
            const count = counts.get(date) ?? 0

            week.push({
                count,
                date,
                level: calendarLevel(count, max),
                outside: cell.isBefore(first) || cell.isAfter(last)
            })
        }

        weeks.push(week)
    }

    return weeks
}

/** Story types behind each filter of the feed page */
export const FEED_FILTERS = {
    achievements: [FeedStoryTypes.Achievement, FeedStoryTypes.Level],
    collections: [FeedStoryTypes.Collection, FeedStoryTypes.CollectionPlace],
    photos: [FeedStoryTypes.Photo, FeedStoryTypes.PhotoLink],
    places: [FeedStoryTypes.Place],
    reviews: [FeedStoryTypes.Comment]
} as const

export type FeedFilter = keyof typeof FEED_FILTERS

export const isFeedFilter = (value: unknown): value is FeedFilter =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(FEED_FILTERS, value)

/** The `types` request parameter of a filter (undefined for the whole feed) */
export const feedFilterTypes = (filter?: FeedFilter): string | undefined =>
    filter ? FEED_FILTERS[filter].join(',') : undefined

/** What a year of the contribution calendar adds up to */
export type CalendarSummary = {
    total: number
    /** Days with at least one event */
    activeDays: number
    /** Most days in a row with events */
    longestStreak: number
    /** Days in a row with events up to today, or up to yesterday when today is still empty */
    currentStreak: number
    busiestDay?: CalendarDay
}

/**
 * Totals and streaks of the calendar days (days with events only, any order).
 *
 * @param today YYYY-MM-DD, the last day of the calendar
 */
export const calendarSummary = (items: CalendarDay[], today: string): CalendarSummary => {
    const active = items.filter((item) => item.count > 0).sort((a, b) => a.date.localeCompare(b.date))
    const activeDates = new Set(active.map((item) => item.date))

    let longestStreak = 0
    let streak = 0
    let previous: string | undefined

    active.forEach((item) => {
        streak = previous && dayjs(previous).add(1, 'day').format('YYYY-MM-DD') === item.date ? streak + 1 : 1
        longestStreak = Math.max(longestStreak, streak)
        previous = item.date
    })

    // Today does not break the streak until it is over
    let day = activeDates.has(today) ? dayjs(today) : dayjs(today).subtract(1, 'day')
    let currentStreak = 0

    while (activeDates.has(day.format('YYYY-MM-DD'))) {
        currentStreak++
        day = day.subtract(1, 'day')
    }

    return {
        activeDays: active.length,
        busiestDay: active.reduce<CalendarDay | undefined>(
            (best, item) => (!best || item.count > best.count ? item : best),
            undefined
        ),
        currentStreak,
        longestStreak,
        total: active.reduce((sum, item) => sum + item.count, 0)
    }
}
