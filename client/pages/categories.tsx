import React from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { CategoriesList } from '@/sections/categories'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

interface CategoriesPageProps {
    categories: ApiModel.Category[]
    topCategories: ApiModel.TopCategory[]
}

const CategoriesPage: NextPage<CategoriesPageProps> = ({ categories, topCategories }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const description = t('categories-places-description')

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('categories-places'),
                    canonical: `${canonicalUrl}categories`,
                    description,
                    openGraph: {
                        description,
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
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('categories')
                })}
            </Head>

            <PageHeader
                title={t('categories-places')}
                description={t('categories-places-description')}
                homePageTitle={t('geotags')}
                currentPage={t('categories-places')}
            />

            <CategoriesList
                categories={categories}
                topCategories={topCategories}
            />
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

            const [{ data: categoriesList }, { data: topCategoriesData }] = await Promise.all([
                store.dispatch(API.endpoints.categoriesGetList.initiate({ places: true })),
                store.dispatch(API.endpoints.categoriesGetTop.initiate())
            ])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    categories: categoriesList?.items ?? [],
                    topCategories: topCategoriesData?.items ?? []
                }
            }
        }
)

export default CategoriesPage
