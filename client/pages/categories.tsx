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
import { CategoriesList } from '@/sections/categories'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

interface CategoriesPageProps {
    categories: ApiModel.Category[]
}

const CategoriesPage: NextPage<CategoriesPageProps> = ({ categories }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const description = useMemo(() => categories.map(({ title }) => title).join(', '), [categories])

    return (
        <AppLayout>
            <NextSeo
                title={t('categories-places')}
                canonical={`${canonicalUrl}categories`}
                description={`${t('categories-places')}: ${description}`}
                openGraph={{
                    description: `${t('categories-places')}: ${description}`,
                    images: [
                        {
                            height: 1402,
                            url: `${SITE_LINK}images/pages/categories.jpg`,
                            width: 1760
                        }
                    ],
                    locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                    siteName: t('geotags'),
                    title: t('categories-places'),
                    type: 'website',
                    url: `${canonicalUrl}categories`
                }}
                twitter={{ cardType: 'summary_large_image' }}
                additionalLinkTags={buildHreflangTags('categories')}
            />

            <Header
                title={t('categories-places')}
                homePageTitle={t('geotags')}
                currentPage={t('categories-places')}
            />

            <CategoriesList categories={categories} />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<CategoriesPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: categoriesList } = await store.dispatch(
                API.endpoints.categoriesGetList.initiate({ places: true })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    categories: categoriesList?.items ?? []
                }
            }
        }
)

export default CategoriesPage
