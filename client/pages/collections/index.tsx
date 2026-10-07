import React from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, EmptyState, MediaTileGrid, PageHeader } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { CollectionCard, CreateCollectionButton } from '@/sections/collections'
import { buildHreflangTags } from '@/utils/seo'

import styles from '@/sections/collections/styles.module.sass'

export const COLLECTIONS_PER_PAGE = 20

interface CollectionsPageProps {
    region: number | null
    currentPage: number
    items: ApiModel.Collection[]
    count: number
}

const CollectionsPage: NextPage<CollectionsPageProps> = ({ region, currentPage, items, count }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const title = t('nav-collections', { defaultValue: 'Коллекции' })

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title,
                    description: t('collections_index-description', {
                        defaultValue: 'Тематические подборки мест от путешественников: коллекции с картой и фото'
                    }),
                    canonical: `${canonicalUrl}collections`,
                    noindex: !!region,
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

            <PageHeader
                title={title}
                actions={<CreateCollectionButton />}
            />

            {items.length ? (
                <MediaTileGrid>
                    {items.map((collection, index) => (
                        <CollectionCard
                            key={collection.id}
                            collection={collection}
                            priority={index < 3}
                        />
                    ))}
                </MediaTileGrid>
            ) : (
                <Container>
                    <EmptyState
                        title={t('collections_empty-title', { defaultValue: 'Коллекций пока нет' })}
                        description={t('collections_empty-description', {
                            defaultValue: 'Никто ещё не собрал ни одной подборки — станьте первым'
                        })}
                    />
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
                    urlParam={{ region: region ?? undefined }}
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
            const currentPage = parseInt(context.query.page as string, 10) || 1

            store.dispatch(setLocale(locale))

            const { data } = await store.dispatch(
                API.endpoints.collectionsGetList.initiate({
                    limit: COLLECTIONS_PER_PAGE,
                    offset: (currentPage - 1) * COLLECTIONS_PER_PAGE,
                    region: region ?? undefined,
                    sort: 'updated'
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    count: data?.count ?? 0,
                    currentPage,
                    items: data?.items ?? [],
                    region
                }
            }
        }
)

export default CollectionsPage
