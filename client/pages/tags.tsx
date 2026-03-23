import React, { useState } from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { SortMode, TagsAlphabetBar, TagsControls, TagsGrid, TagsStats, TagsTrending } from '@/sections/tags'
import { buildHreflangTags } from '@/utils/seo'

interface TagsPageProps {
    tags: ApiModel.Tag[]
}

const TagsPage: NextPage<TagsPageProps> = ({ tags }) => {
    const { t, i18n } = useTranslation()
    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const [searchQuery, setSearchQuery] = useState<string>('')
    const [sortMode, setSortMode] = useState<SortMode>('alpha')

    const tagsList = tags ?? []

    const filteredTagsForAlphabet = tagsList.filter((tag) =>
        tag.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <AppLayout>
            <NextSeo
                title={t('features-of-places')}
                canonical={`${canonicalUrl}tags`}
                description={`${t('features-of-places')}: ${tagsList
                    .map(({ title }) => title)
                    .join(', ')
                    .substring(0, 180)}`}
                openGraph={{
                    description: `${t('features-of-places')}: ${tagsList
                        .map(({ title }) => title)
                        .join(', ')
                        .substring(0, 180)}`,
                    locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                    siteName: t('geotags'),
                    title: t('features-of-places'),
                    type: 'website',
                    url: `${canonicalUrl}tags`
                }}
                twitter={{ cardType: 'summary_large_image' }}
                additionalLinkTags={buildHreflangTags('tags')}
            />

            <div className={'pageContainer'}>
                <Header
                    title={t('features-of-places')}
                    homePageTitle={t('geotags')}
                    currentPage={t('features-of-places')}
                />

                <TagsStats tags={tagsList} />

                <TagsTrending tags={tagsList} />

                <TagsControls
                    searchQuery={searchQuery}
                    sortMode={sortMode}
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortMode}
                />

                <TagsAlphabetBar
                    tags={filteredTagsForAlphabet}
                    sortMode={sortMode}
                />

                <TagsGrid
                    tags={tagsList}
                    searchQuery={searchQuery}
                    sortMode={sortMode}
                    onClearSearch={() => setSearchQuery('')}
                />
            </div>
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

export default TagsPage
