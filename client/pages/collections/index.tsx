import React, { useMemo } from 'react'
import { cn, Container, Select, SelectOptionType } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, EmptyState, Header } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { CollectionCard } from '@/sections/collections'
import { buildHreflangTags } from '@/utils/seo'

import styles from '@/sections/collections/styles.module.sass'

export const COLLECTIONS_PER_PAGE = 20

interface CollectionsPageProps {
    region: number | null
    category: string | null
    currentPage: number
    items: ApiModel.Collection[]
    count: number
}

const CollectionsPage: NextPage<CollectionsPageProps> = ({ region, category, currentPage, items, count }) => {
    const { t, i18n } = useTranslation()
    const router = useRouter()

    const { data: categoryData } = API.useCategoriesGetListQuery()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const title = t('nav-collections', { defaultValue: 'Коллекции' })

    const categoryOptions = useMemo<Array<SelectOptionType<string>>>(
        () => categoryData?.items?.map((item) => ({ key: item.name, value: item.title })) ?? [],
        [categoryData?.items]
    )

    const handleCategoryChange = (selected?: Array<SelectOptionType<string>>) => {
        void router.push({
            pathname: '/collections',
            query: {
                ...(region ? { region } : {}),
                ...(selected?.[0]?.key ? { category: selected[0].key } : {})
            }
        })
    }

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title,
                    description: t('collections_index-description', {
                        defaultValue: 'Тематические подборки мест от путешественников: коллекции с картой и фото'
                    }),
                    canonical: `${canonicalUrl}collections`,
                    noindex: !!region || !!category,
                    openGraph: {
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: `${canonicalUrl}collections`
                    },
                    additionalLinkTags: buildHreflangTags('collections')
                })}
            </Head>

            <Header
                title={title}
                homePageTitle={t('geotags')}
                currentPage={title}
            />

            <Container className={styles.filters}>
                <Select<string>
                    label={t('collections_category-label', { defaultValue: 'Категория' })}
                    options={categoryOptions}
                    value={category ? [category] : undefined}
                    onSelect={handleCategoryChange}
                />
            </Container>

            {items.length ? (
                <Container>
                    <div className={styles.grid}>
                        {items.map((collection) => (
                            <CollectionCard
                                key={collection.id}
                                collection={collection}
                            />
                        ))}
                    </div>
                </Container>
            ) : (
                <Container>
                    <EmptyState />
                </Container>
            )}

            <Container className={cn('paginationContainer', count <= COLLECTIONS_PER_PAGE ? 'hide' : '')}>
                <div className={styles.countContainer}>
                    {t('nav-collections', { defaultValue: 'Коллекции' })}: <strong>{count}</strong>
                </div>

                <Pagination
                    currentPage={currentPage}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    totalItemsCount={count}
                    perPage={COLLECTIONS_PER_PAGE}
                    linkPart={'collections'}
                    urlParam={{ category: category ?? undefined, region: region ?? undefined }}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<CollectionsPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            const region = context.query.region ? Number(context.query.region) : null
            const category = typeof context.query.category === 'string' ? context.query.category : null
            const currentPage = parseInt(context.query.page as string, 10) || 1

            store.dispatch(setLocale(locale))

            const { data } = await store.dispatch(
                API.endpoints.collectionsGetList.initiate({
                    category: category ?? undefined,
                    limit: COLLECTIONS_PER_PAGE,
                    offset: (currentPage - 1) * COLLECTIONS_PER_PAGE,
                    region: region ?? undefined,
                    sort: 'popular'
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    category,
                    count: data?.count ?? 0,
                    currentPage,
                    items: data?.items ?? [],
                    region
                }
            }
        }
)

export default CollectionsPage
