import React, { useMemo } from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { TagList } from '@/sections/tags'
import { dateToUnixTime } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'

interface TagsPageProps {
    tags: ApiModel.Tag[]
}

const CategoriesPage: NextPage<TagsPageProps> = ({ tags }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const tagsList = [...tags]

    const topUpdatedTags = useMemo(
        () => tagsList.sort((a, b) => dateToUnixTime(b.updated?.date) - dateToUnixTime(a.updated?.date)).slice(0, 20),
        [tagsList]
    )

    const topPopularTags = useMemo(
        () =>
            tagsList
                .sort((a, b) => b.count! - a.count!)
                .filter(({ title }) => title !== topUpdatedTags.find((search) => search.title === title)?.title)
                .slice(0, 20),
        [tagsList, topUpdatedTags]
    )

    const otherTags = useMemo(
        () =>
            tagsList
                .sort((a, b) => b.count! - a.count!)
                .filter(
                    ({ title }) =>
                        title !== topUpdatedTags.find((search) => search.title === title)?.title &&
                        title !== topPopularTags.find((search) => search.title === title)?.title
                ),
        [tagsList, topUpdatedTags, topPopularTags]
    )

    return (
        <AppLayout>
            <NextSeo
                title={t('features-of-places')}
                canonical={`${canonicalUrl}tags`}
                description={`${t('features-of-places')}: ${tagsList
                    ?.map(({ title }) => title)
                    ?.join(', ')
                    ?.substring(0, 180)}`}
                openGraph={{
                    description: `${t('features-of-places')}: ${tagsList
                        ?.map(({ title }) => title)
                        ?.join(', ')
                        ?.substring(0, 180)}`,
                    locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                    siteName: t('geotags'),
                    title: t('features-of-places'),
                    type: 'website',
                    url: `${canonicalUrl}tags`
                }}
                twitter={{ cardType: 'summary_large_image' }}
                additionalLinkTags={buildHreflangTags('tags')}
            />

            <Header
                title={t('features-of-places')}
                homePageTitle={t('geotags')}
                currentPage={t('features-of-places')}
            />

            <TagList
                title={t('last-used')}
                tags={topUpdatedTags}
            />

            <TagList
                title={t('most-popular')}
                tags={topPopularTags}
            />

            <TagList
                title={t('other')}
                tags={otherTags}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<TagsPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))

            const { data: tagsList } = await store.dispatch(API.endpoints.tagsGetList.initiate())

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    tags: tagsList?.items ?? []
                }
            }
        }
)

export default CategoriesPage
