import React, { useEffect, useMemo, useRef } from 'react'
import dayjs from 'dayjs'
import { cn, Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { buildCalendarWeeks } from '@/utils/feed'

import styles from './styles.module.sass'

export interface ContributionCalendarProps {
    calendar?: ApiType.Feed.CalendarResponse
    className?: string
}

/**
 * A year of a person's activity, a square per day coloured by how much they did, weeks as
 * columns (the GitHub contribution graph). The squares stretch to the full width of the page;
 * below their minimum size (phones) the year scrolls sideways, opened at its end — the latest
 * weeks. Weeks start on Monday in Russian and on Sunday in English. It is a card (`Container`):
 * on the page background the empty squares would merge with it.
 */
export const ContributionCalendar: React.FC<ContributionCalendarProps> = ({ calendar, className }) => {
    const { t, i18n } = useTranslation()
    const scrollRef = useRef<HTMLDivElement>(null)

    const weekStart = i18n.language === 'en' ? 0 : 1

    const weeks = useMemo(
        () => (calendar ? buildCalendarWeeks(calendar.items, calendar.from, calendar.to, weekStart) : []),
        [calendar, weekStart]
    )

    // Month name over the first week that starts in it
    const months = useMemo(
        () =>
            weeks.map((week, index) => {
                const firstDay = week.find((cell) => !cell.outside) ?? week[0]
                const month = dayjs(firstDay.date).month()
                const previous = index > 0 ? dayjs(weeks[index - 1][0].date).month() : -1

                return index === 0 || month !== previous ? dayjs(firstDay.date).locale(i18n.language).format('MMM') : ''
            }),
        [weeks, i18n.language]
    )

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
        }
    }, [weeks])

    if (!calendar) {
        return null
    }

    const dayName = (row: number) =>
        dayjs()
            .day((row + weekStart) % 7)
            .locale(i18n.language)
            .format('dd')

    const cellTitle = (date: string, count: number) =>
        `${
            count
                ? t('calendar-actions', { count, defaultValue: '{{count}} действий' })
                : t('calendar-no-actions', { defaultValue: 'Нет действий' })
        }, ${dayjs(date).locale(i18n.language).format('D MMMM YYYY')}`

    return (
        <Container
            className={cn(styles.calendar, className)}
            title={t('calendar-title', { defaultValue: 'Активность за год' })}
            action={
                <span className={styles.total}>
                    {t('calendar-actions', { count: calendar.total, defaultValue: '{{count}} действий' })}
                </span>
            }
        >
            <div
                className={styles.scroll}
                ref={scrollRef}
            >
                <div
                    className={styles.graph}
                    style={{ '--weeks': weeks.length } as React.CSSProperties}
                    role={'img'}
                    aria-label={`${t('calendar-title', { defaultValue: 'Активность за год' })}: ${t(
                        'calendar-actions',
                        {
                            count: calendar.total,
                            defaultValue: '{{count}} действий'
                        }
                    )}`}
                >
                    {/* One grid: weekday names in the first column, a column per week, month names over it */}
                    {[1, 3, 5].map((row) => (
                        <span
                            key={`weekday-${row}`}
                            className={styles.weekday}
                            style={{ gridRow: row + 2 }}
                            aria-hidden={true}
                        >
                            {dayName(row)}
                        </span>
                    ))}

                    {weeks.map((week, column) => (
                        <React.Fragment key={week[0].date}>
                            {months[column] && (
                                <span
                                    className={styles.month}
                                    style={{ gridColumn: column + 2 }}
                                    aria-hidden={true}
                                >
                                    {months[column]}
                                </span>
                            )}
                            {week.map((cell, row) => (
                                <span
                                    key={cell.date}
                                    className={cn(styles.cell, cell.outside && styles.outside)}
                                    style={{ gridColumn: column + 2, gridRow: row + 2 }}
                                    data-level={cell.level}
                                    title={cell.outside ? undefined : cellTitle(cell.date, cell.count)}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div
                className={styles.legend}
                aria-hidden={true}
            >
                {t('calendar-less', { defaultValue: 'Меньше' })}
                {[0, 1, 2, 3, 4].map((level) => (
                    <span
                        key={level}
                        className={cn(styles.cell, styles.legendCell)}
                        data-level={level}
                    />
                ))}
                {t('calendar-more', { defaultValue: 'Больше' })}
            </div>
        </Container>
    )
}
