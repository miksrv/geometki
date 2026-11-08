import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { ContributionCalendar, ContributionSummary, FeedList } from '@/components/shared'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { flattenFeedPages } from '@/utils/feed'

import styles from './styles.module.sass'

interface UserActivityProps {
    userId: string
    /** Blocks of the main column between the year's calendar and the feed (the map, the photos) */
    beforeFeed?: React.ReactNode
    /** Blocks of the side column under "the year in numbers" (achievements, contribution) */
    aside?: React.ReactNode
}

/**
 * The overview tab of the profile, the two columns of the place page: the main column with the
 * year's calendar first, then `beforeFeed` and the person's feed by day; the side column with
 * "the year in numbers" and `aside`. On narrower screens the side column comes first.
 */
export const UserActivity: React.FC<UserActivityProps> = ({ userId, beforeFeed, aside }) => {
    const { t } = useTranslation()
    const timeZone = useAppSelector((state) => state.application.timeZone)

    const { data, isFetching, isFetchingNextPage, isError, isLoading, hasNextPage, fetchNextPage } =
        API.useFeedGetListInfiniteQuery({ author: userId })
    // A page after the first failed (the first failing leaves the feed empty)
    const nextPageFailed = isError && !!data?.pages.length
    const { data: calendar } = API.useFeedGetCalendarQuery({ author: userId, tz: timeZone })

    const sentinelRef = useInfiniteScroll({
        hasMore: hasNextPage,
        loading: isFetching,
        failed: nextPageFailed,
        onLoadMore: fetchNextPage
    })

    return (
        <div className={styles.layout}>
            <aside className={styles.aside}>
                <ContributionSummary calendar={calendar} />
                {aside}
            </aside>

            <div className={styles.main}>
                <ContributionCalendar calendar={calendar} />

                {beforeFeed}

                <section aria-label={t('activity-feed')}>
                    <FeedList
                        stories={flattenFeedPages(data?.pages)}
                        loading={isLoading || isFetchingNextPage}
                        groupByDay={true}
                        timeZone={timeZone}
                        emptyText={t('feed-empty-user', { defaultValue: 'Пока ничего не сделано' })}
                        footer={
                            nextPageFailed ? (
                                <Button
                                    mode={'secondary'}
                                    stretched={true}
                                    onClick={() => fetchNextPage()}
                                >
                                    {t('feed-retry', { defaultValue: 'Не удалось загрузить. Повторить' })}
                                </Button>
                            ) : undefined
                        }
                    />
                    <div ref={sentinelRef} />
                </section>
            </div>
        </div>
    )
}
