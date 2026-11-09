import dayjs from 'dayjs'

export const formatDate = (date?: string | Date, format: string = 'D MMMM YYYY, HH:mm'): string =>
    date ? dayjs.utc(date).local().format(format) : ''

export const dateToUnixTime = (date?: string | Date): number => dayjs(date).unix()

export const formatDateISO = (date?: string | Date): string => (date ? dayjs(date).toISOString() : '')

export const timeAgo = (date?: string | Date, withoutSuffix?: boolean, locale?: string): string =>
    date
        ? dayjs
              .utc(date)
              .locale(locale ?? dayjs.locale())
              .fromNow(withoutSuffix)
        : ''

export const minutesAgo = (date?: string | Date): number => (date ? dayjs().diff(dayjs.utc(date), 'minute') : 99999999)

/** A user counts as online for this long after their last request */
export const ONLINE_MINUTES = 15

/** Online by their last request (`activity`): the green mark of the avatar, the cards and the profile */
export const isOnlineAt = (activity?: string | Date): boolean => !!activity && minutesAgo(activity) <= ONLINE_MINUTES

export const formatDateUTC = (date?: string | Date): string =>
    date ? dayjs(date).format('YYYY-MM-DDTHH:mm:ss[Z]') : ''

const PLAIN_DATE = 'YYYY-MM-DD'

/**
 * A plain calendar day (`YYYY-MM-DD`, a visit day) in the viewer's format, with no time zone
 * conversion: `new Date('2026-10-13')` is UTC midnight and shows the 12th west of Greenwich
 */
export const formatPlainDate = (date?: string, format: string = 'D MMMM YYYY'): string => {
    if (!date) {
        return ''
    }

    const [year, month, day] = date.slice(0, 10).split('-').map(Number)

    return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
        ? dayjs(new Date(year, month - 1, day)).format(format)
        : ''
}

/** The viewer's calendar day, shifted by `offsetDays`, as `YYYY-MM-DD` (their local day, not UTC) */
export const localPlainDate = (offsetDays: number = 0, now: Date = new Date()): string =>
    dayjs(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)).format(PLAIN_DATE)

/** The calendar year of a plain day or of an ISO date-time; `undefined` when there is none */
export const plainDateYear = (date?: string): number | undefined => {
    const year = Number(date?.slice(0, 4))

    return Number.isInteger(year) && year > 0 ? year : undefined
}

/**
 * Whole days from one plain day (`YYYY-MM-DD`) to another, negative when `to` is earlier;
 * `undefined` when either is not a day
 */
export const daysBetweenPlainDates = (from: string, to: string): number | undefined => {
    const parse = (day: string) => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN)
    const diff = (parse(to) - parse(from)) / 86400000

    return Number.isFinite(diff) ? Math.round(diff) : undefined
}
