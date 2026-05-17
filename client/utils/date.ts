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

export const formatDateUTC = (date?: string | Date): string =>
    date ? dayjs(date).format('YYYY-MM-DDTHH:mm:ss[Z]') : ''
