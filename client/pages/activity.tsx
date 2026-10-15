import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale, setTimeZone } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, FeedList, FeedPulse, PageHeader } from '@/components/shared'
import { Tabs } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { FEED_FILTERS, FeedFilter, feedFilterTypes, flattenFeedPages, isFeedFilter } from '@/utils/feed'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getTimeZoneFromCookies } from '@/utils/timeZone'

import styles from './activity.module.sass'

interface ActivityPageProps {
    filter: FeedFilter | null
}

const FILTER_LABELS: Record<FeedFilter, string> = {
    achievements: 'feed-filter-achievements',
    collections: 'feed-filter-collections',
    photos: 'feed-filter-photos',
    places: 'feed-filter-places',
    reviews: 'feed-filter-reviews'
}

const feedRequest = (filter: FeedFilter | null): ApiType.Feed.ListRequest => ({
    types: feedFilterTypes(filter ?? undefined)
})

const ActivityPage: NextPage<ActivityPageProps> = ({ filter }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const { data, isFetching, isFetchingNextPage, isError, isLoading, hasNextPage, fetchNextPage } =
        API.useFeedGetListInfiniteQuery(feedRequest(filter))
    // A page after the first failed (the first failing leaves the feed empty)
    const nextPageFailed = isError && !!data?.pages.length
    const { data: pulse } = API.useFeedGetPulseQuery()
    const timeZone = useAppSelector((state) => state.application.timeZone)

    const sentinelRef = useInfiniteScroll({
        hasMore: hasNextPage,
        loading: isFetching,
        failed: nextPageFailed,
        onLoadMore: fetchNextPage
    })

    const tabs = [
        { href: '/activity', key: 'all', label: t('feed-filter-all', { defaultValue: 'Всё' }) },
        ...(Object.keys(FEED_FILTERS) as FeedFilter[]).map((key) => ({
            href: `/activity?type=${key}`,
            key,
            label: t(FILTER_LABELS[key])
        }))
    ]

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('activity-feed'),
                    description: t('activity-description'),
                    canonical: `${canonicalUrl}activity`,
                    noindex: !!filter,
                    openGraph: {
                        description: t('activity-description'),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: t('activity-feed'),
                        type: 'website',
                        url: `${canonicalUrl}activity`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('activity')
                })}
            </Head>

            <PageHeader title={t('activity-feed')} />

            <div className={styles.layout}>
                <aside className={styles.aside}>
                    <FeedPulse pulse={pulse} />
                </aside>

                <div className={styles.main}>
                    <Tabs
                        tabs={tabs}
                        activeTab={filter ?? 'all'}
                        aria-label={t('feed-filters', { defaultValue: 'Что показывать' })}
                    />

                    <FeedList
                        stories={flattenFeedPages(data?.pages)}
                        loading={isLoading || isFetchingNextPage}
                        groupByDay={true}
                        timeZone={timeZone}
                        emptyText={t('feed-empty', { defaultValue: 'Здесь пока ничего не произошло' })}
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
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<ActivityPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)
            const filter = isFeedFilter(context.query.type) ? context.query.type : null

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))
            store.dispatch(setTimeZone(getTimeZoneFromCookies(cookies)))

            await Promise.all([
                store.dispatch(API.endpoints.feedGetList.initiate(feedRequest(filter))),
                store.dispatch(API.endpoints.feedGetPulse.initiate())
            ])

            return {
                props: {
                    ...translations,
                    filter
                }
            }
        }
)

export default ActivityPage
