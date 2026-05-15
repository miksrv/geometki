import React, { useCallback, useEffect, useState } from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { ActivityList, AppLayout, Header } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const ActivityPage: NextPage<object> = () => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const [lastDate, setLastDate] = useState<string>()

    const { data, isFetching } = API.useActivityGetInfinityListQuery({ date: lastDate })

    const onScroll = useCallback(() => {
        const scrolledToBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 20
        const cursorDate = data?.items[data.items.length - 1]?.created?.date

        if (scrolledToBottom && !isFetching && cursorDate) {
            setLastDate(cursorDate)
        }
    }, [data, isFetching])

    useEffect(() => {
        document.addEventListener('scroll', onScroll)

        return () => {
            document.removeEventListener('scroll', onScroll)
        }
    }, [onScroll])

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('news-feed'),
                    description: t('activity-description'),
                    canonical: `${canonicalUrl}activity`,
                    openGraph: {
                        description: t('activity-description'),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: t('news-feed'),
                        type: 'website',
                        url: `${canonicalUrl}activity`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('activity')
                })}
            </Head>

            <Header
                title={t('news-feed')}
                homePageTitle={t('geotags')}
                currentPage={t('news-feed')}
            />

            <ActivityList
                activities={data?.items}
                loading={isFetching}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            await store.dispatch(API.endpoints.activityGetInfinityList.initiate({}))

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations
                }
            }
        }
)

export default ActivityPage
