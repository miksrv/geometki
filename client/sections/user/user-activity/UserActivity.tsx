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
}

/**
 * The activity tab of the profile: the year's calendar across the page, then the person's
 * feed by day with "the year in numbers" in a sticky column beside it — the same two
 * columns as the feed page with its pulse.
 */
export const UserActivity: React.FC<UserActivityProps> = ({ userId }) => {
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
        <>
            <ContributionCalendar calendar={calendar} />

            <div className={styles.layout}>
                <aside className={styles.aside}>
                    <ContributionSummary calendar={calendar} />
                </aside>

                <div className={styles.main}>
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
                </div>
            </div>
        </>
    )
}
