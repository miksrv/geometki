import React from 'react'
import dayjs from 'dayjs'
import { Button, cn, Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { EmptyState, ScoreStars, Section } from '@/components/shared'
import { isAbsoluteUrl, resolveImageUrl } from '@/components/shared/photo-lightbox/utils'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { categoryImage } from '@/utils/categories'
import { formatDate } from '@/utils/date'
import { buildPlaceUrl } from '@/utils/helpers'

import styles from './styles.module.sass'

interface UserReputationProps {
    userId: string
}

/** Skeleton rows: three before the first page, two under the list while the next one loads */
const LOADER_ROWS_FIRST = 3
const LOADER_ROWS_NEXT = 2

/** "+1", "−0,5": the sign always, up to two decimals in the page's locale */
export const formatPoints = (points: number, locale: string): string => {
    const value = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 }).format(
        Math.abs(points)
    )

    return `${points > 0 ? '+' : points < 0 ? '−' : ''}${value}`
}

export interface ReputationMonth {
    /** `YYYY-MM` in the visitor's time */
    month: string
    points: number
    items: ApiType.Users.ReputationItem[]
}

/** The scores by the month they were given in, in the visitor's time, the order kept */
export const groupByMonth = (items: ApiType.Users.ReputationItem[]): ReputationMonth[] =>
    items.reduce<ReputationMonth[]>((months, item) => {
        const month = formatDate(item.created?.date, 'YYYY-MM')
        const last = months[months.length - 1]

        if (last?.month === month) {
            last.items.push(item)
            last.points += item.points
        } else {
            months.push({ items: [item], month, points: item.points })
        }

        return months
    }, [])

const Points: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
    const { i18n } = useTranslation()

    return (
        <span className={cn(styles.points, value > 0 ? styles.positive : value < 0 && styles.negative, className)}>
            {formatPoints(value, i18n.language)}
        </span>
    )
}

const Row: React.FC<{ item: ApiType.Users.ReputationItem }> = ({ item }) => {
    const { t } = useTranslation()
    const { place } = item
    const placeHref = place ? buildPlaceUrl(place.id, place.slug) : undefined
    const cover = place?.cover?.preview

    return (
        <li className={styles.row}>
            <span
                className={styles.cover}
                aria-hidden={true}
            >
                {cover ? (
                    <Image
                        src={resolveImageUrl(cover) ?? ''}
                        unoptimized={isAbsoluteUrl(cover)}
                        alt={''}
                        width={112}
                        height={84}
                    />
                ) : (
                    // No photo: the category icon, as the place's marker on the map
                    <Image
                        className={styles.categoryIcon}
                        src={categoryImage(place?.category).src}
                        alt={''}
                        width={24}
                        height={24}
                    />
                )}
            </span>

            <div className={styles.body}>
                {placeHref ? (
                    <Link
                        href={placeHref}
                        className={styles.name}
                    >
                        {place?.title}
                    </Link>
                ) : (
                    <span className={styles.name}>{t('reputation-history-place-gone')}</span>
                )}
                <span className={styles.meta}>
                    <ScoreStars
                        value={item.stars}
                        variant={'single'}
                    />
                    <span className={styles.why}>{t(`reputation-history-${item.role}`)}</span>
                    <time
                        className={styles.day}
                        dateTime={item.created?.date}
                    >
                        {formatDate(item.created?.date, 'D MMMM')}
                    </time>
                </span>
            </div>

            <Points value={item.points} />
        </li>
    )
}

const RowLoader: React.FC = () => (
    <li
        className={styles.row}
        aria-hidden={true}
    >
        <Skeleton className={styles.cover} />
        <div className={styles.body}>
            <Skeleton className={styles.loaderTitle} />
            <Skeleton className={styles.loaderMeta} />
        </div>
        <Skeleton className={styles.loaderPoints} />
    </li>
)

const Loaders: React.FC<{ count: number }> = ({ count }) => (
    <ul
        className={styles.list}
        data-testid={'reputation-loader'}
    >
        {Array.from({ length: count }, (_, index) => (
            <RowLoader key={index} />
        ))}
    </ul>
)

/**
 * The history of a person's reputation (`pages/users/[id]/reputation.tsx`): every score that
 * moved it, the newest first, loaded as the list scrolls and grouped by month under an overline
 * with the month's sum. A row is a low card like the achievements: the place's cover (or its
 * category icon), its title over the stars, why the person got a share (the author of the place
 * or a contributor to its card) and the day, the share in a tinted badge. Who scored is not told.
 */
export const UserReputation: React.FC<UserReputationProps> = ({ userId }) => {
    const { t, i18n } = useTranslation()

    const { data, isFetching, isFetchingNextPage, isError, isLoading, hasNextPage, fetchNextPage, refetch } =
        API.useUsersGetReputationInfiniteQuery({ id: userId })
    const nextPageFailed = isError && !!data?.pages.length
    // The first page failed: not "no scores yet", a retry
    const firstPageFailed = isError && !data?.pages.length
    const items = data?.pages.flatMap((page) => page.items) ?? []
    const count = data?.pages[0]?.count

    const sentinelRef = useInfiniteScroll({
        failed: nextPageFailed,
        hasMore: hasNextPage,
        loading: isFetching,
        onLoadMore: fetchNextPage
    })

    const monthTitle = (month: string) => {
        const date = dayjs(`${month}-01`).locale(i18n.language)

        return date.format(date.year() === dayjs().year() ? 'MMMM' : 'MMMM YYYY')
    }

    return (
        <Section
            className={styles.reputation}
            title={
                <>
                    {t('reputation-history-title')}
                    {!!count && <span className={styles.count}>{t('reputation-history-count', { count })}</span>}
                </>
            }
        >
            {isLoading ? (
                <Loaders count={LOADER_ROWS_FIRST} />
            ) : firstPageFailed ? null : !items.length ? (
                <EmptyState
                    title={t('reputation-history-empty-title')}
                    description={t('reputation-history-empty-text')}
                />
            ) : (
                <div className={styles.months}>
                    {groupByMonth(items).map(({ month, points, items: monthItems }, index, months) => (
                        <section
                            key={month}
                            className={styles.month}
                            aria-labelledby={`reputation-${month}`}
                        >
                            <h3
                                id={`reputation-${month}`}
                                className={styles.monthHeading}
                            >
                                <span>{monthTitle(month)}</span>
                                {/* The last month loaded may go on on the next page: its sum only once it is whole */}
                                {(index < months.length - 1 || !hasNextPage) && (
                                    <Points
                                        value={Math.round(points * 100) / 100}
                                        className={styles.monthPoints}
                                    />
                                )}
                            </h3>
                            <ul className={styles.list}>
                                {monthItems.map((item) => (
                                    <Row
                                        key={item.id}
                                        item={item}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            {isFetchingNextPage && <Loaders count={LOADER_ROWS_NEXT} />}

            {(nextPageFailed || firstPageFailed) && (
                <Button
                    mode={'secondary'}
                    stretched={true}
                    onClick={() => void (firstPageFailed ? refetch() : fetchNextPage())}
                >
                    {t('feed-retry', { defaultValue: 'Не удалось загрузить. Повторить' })}
                </Button>
            )}

            <div ref={sentinelRef} />
        </Section>
    )
}
