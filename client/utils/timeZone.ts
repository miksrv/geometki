import { getCookie, setCookie } from 'cookies-next'

/**
 * The visitor's time zone, so that calendar days (the day headings of the feed, the contribution
 * calendar) are the visitor's days. The browser keeps it in this cookie (`rememberTimeZone`, on
 * every app start), the server render reads it from the request: both group by the same zone and
 * the page does not change after hydration. Without the cookie (the very first page) days are the
 * site's days.
 */
export const TIME_ZONE_COOKIE = 'tz'

// One year, in seconds
export const TIME_ZONE_MAX_AGE = 365 * 24 * 60 * 60

/** The site's time zone: days of visitors whose zone is not known yet (server: SITE_TIMEZONE) */
export const SITE_TIME_ZONE = 'Europe/Moscow'

/** An IANA zone name the runtime knows, e.g. "America/Los_Angeles" */
export const isTimeZone = (value?: string | null): value is string => {
    if (!value || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) {
        return false
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value })

        return true
    } catch {
        return false
    }
}

/** The visitor's time zone from the request cookies, for server-rendered days */
export const getTimeZoneFromCookies = (cookies: Partial<Record<string, string>>): string | undefined => {
    const value = cookies[TIME_ZONE_COOKIE]

    return isTimeZone(value) ? value : undefined
}

/** The time zone of this browser */
export const getBrowserTimeZone = (): string | undefined => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return isTimeZone(zone) ? zone : undefined
}

/** Keep this browser's zone in the cookie for the next server renders. Changes nothing on the page */
export const rememberTimeZone = (): void => {
    const zone = getBrowserTimeZone()

    if (zone && getCookie(TIME_ZONE_COOKIE) !== zone) {
        void setCookie(TIME_ZONE_COOKIE, zone, { maxAge: TIME_ZONE_MAX_AGE })
    }
}

/** YYYY-MM-DD of a moment in a time zone */
export const zonedDay = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone,
        year: 'numeric'
    }).formatToParts(date)

    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''

    return `${part('year')}-${part('month')}-${part('day')}`
}
