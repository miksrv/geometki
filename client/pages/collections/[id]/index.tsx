import React, { useMemo } from 'react'
import Markdown from 'react-markdown'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, Header, UserAvatar } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { CollectionOwnerPanel, CollectionPlacesList } from '@/sections/collections'
import { computeCollectionFacts } from '@/utils/collectionFacts'
import {
    buildCollectionUrl,
    encodeQueryData,
    formatDate,
    parseCollectionId,
    removeMarkdown,
    truncateText
} from '@/utils/helpers'

const CollectionMap = dynamic(() => import('@/sections/collections/collection-map').then((m) => m.CollectionMap), {
    ssr: false
})

interface CollectionPageProps {
    id: string
    collection?: ApiModel.Collection
}

const CollectionPage: NextPage<CollectionPageProps> = ({ collection }) => {
    const { t, i18n } = useTranslation()
    const userId = useAppSelector((state) => state.auth.user?.id)

    const [reorderPlaces] = API.useCollectionsReorderPlacesMutation()
    const [removePlace] = API.useCollectionsRemovePlaceMutation()

    const siteBase = SITE_LINK?.endsWith('/') ? SITE_LINK : `${SITE_LINK}/`
    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const path = buildCollectionUrl(collection?.id ?? '', collection?.slug).replace(/^\//, '')
    const pageUrl = `${canonicalUrl}${path}`
    // Collections have no English title/description yet (planned for a later phase):
    // the /en page is noindex and canonicalises back to the ru page instead of itself, and gets
    // no hreflang pair.
    const ruPageUrl = `${siteBase}${path}`
    const canonicalPageUrl = i18n.language === 'en' ? ruPageUrl : pageUrl
    const isOwner = !!userId && userId === collection?.author.id

    const handleReorder = async (order: string[]) => {
        if (collection) {
            await reorderPlaces({ id: collection.id, order })
        }
    }

    const handleNoteChange = async (placeId: string, note: string | null) => {
        if (collection) {
            await reorderPlaces({ id: collection.id, note, placeId })
        }
    }

    const handleRemove = async (placeId: string) => {
        if (collection) {
            await removePlace({ id: collection.id, placeId })
        }
    }

    const facts = useMemo(() => computeCollectionFacts(collection?.places), [collection?.places])

    const description =
        collection?.metaDescription ||
        truncateText(removeMarkdown(collection?.description ?? undefined)?.replace(/\n/g, ' '), 160)

    const itemListSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            dateModified: collection?.updated?.date,
            mainEntity: {
                '@type': 'ItemList',
                itemListElement: (collection?.places ?? []).map((place, index) => ({
                    '@type': 'ListItem',
                    item: {
                        '@type': 'TouristAttraction',
                        geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lon },
                        name: place.title
                    },
                    position: index + 1
                }))
            },
            name: collection?.title
        }),
        [collection]
    )

    const breadcrumbSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', item: canonicalUrl, name: t('geotags'), position: 1 },
                {
                    '@type': 'ListItem',
                    item: `${canonicalUrl}collections`,
                    name: t('nav-collections', { defaultValue: 'Коллекции' }),
                    position: 2
                },
                { '@type': 'ListItem', item: pageUrl, name: collection?.title, position: 3 }
            ]
        }),
        [canonicalUrl, pageUrl, collection?.title, t]
    )

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('collections_seo-title', {
                        count: collection?.placesCount,
                        defaultValue: `${collection?.title}: {{count}} мест на карте с фото | Геометки`,
                        title: collection?.title
                    }),
                    description,
                    canonical: canonicalPageUrl,
                    noindex: !collection?.indexable || i18n.language === 'en',
                    nofollow: false,
                    openGraph: {
                        description,
                        images: collection?.cover
                            ? [{ url: collection.cover.full ?? '', alt: collection.title }]
                            : undefined,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: collection?.title,
                        type: 'website',
                        url: pageUrl
                    }
                })}
            </Head>

            <JsonLdScript
                scriptKey={'collection-schema'}
                data={itemListSchema}
            />
            <JsonLdScript
                scriptKey={'collection-breadcrumb'}
                data={breadcrumbSchema}
            />

            <Header
                title={collection?.title}
                homePageTitle={t('geotags')}
                currentPage={collection?.title}
                links={[{ link: '/collections', text: t('nav-collections', { defaultValue: 'Коллекции' }) }]}
            />

            <Container>
                <UserAvatar
                    user={
                        collection?.author
                            ? {
                                  id: collection.author.id,
                                  name: collection.author.name,
                                  avatar: collection.author.avatar ?? undefined
                              }
                            : undefined
                    }
                    size={'medium'}
                    showName={true}
                />
                <p>
                    {t('collections_updated-at', { defaultValue: 'Обновлено' })}{' '}
                    {collection?.updated && formatDate(collection.updated.date, 'D MMMM YYYY')} ·{' '}
                    {t('collections_places-count', {
                        count: collection?.placesCount,
                        defaultValue: '{{count}} мест'
                    })}
                </p>

                {collection?.description && (
                    <div>
                        <Markdown
                            components={{
                                a: ({ node: _node, ...props }) => (
                                    <a
                                        {...props}
                                        rel={'nofollow ugc'}
                                    />
                                )
                            }}
                        >
                            {collection.description}
                        </Markdown>
                    </div>
                )}
            </Container>

            {!!collection?.places?.length && (
                <CollectionMap
                    places={collection.places.map((place) => ({
                        id: place.id,
                        lat: place.lat,
                        lon: place.lon,
                        title: place.title
                    }))}
                />
            )}

            <Container title={t('collections_places-in-collection', { defaultValue: 'Места в коллекции' })}>
                <CollectionPlacesList
                    places={collection?.places ?? []}
                    editable={isOwner}
                    onReorder={handleReorder}
                    onNoteChange={handleNoteChange}
                    onRemove={handleRemove}
                />
            </Container>

            <Container title={t('collections_facts-title', { defaultValue: 'Коротко о коллекции' })}>
                <p>
                    {t('collections_facts-summary', {
                        defaultValue: '{{places}} мест, {{photos}} фото, маршрут около {{km}} км',
                        km: facts.routeLengthKm,
                        photos: facts.photosCount,
                        places: facts.placesCount
                    })}
                </p>
            </Container>

            {isOwner && collection && <CollectionOwnerPanel collection={collection} />}
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<CollectionPageProps>> => {
            const rawParam = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            if (!rawParam) {
                return { notFound: true }
            }

            const id = parseCollectionId(rawParam)

            if (!id) {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data, isError } = await store.dispatch(API.endpoints.collectionsGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            const canonicalParam = data?.slug ? `${id}-${data.slug}` : id

            if (rawParam !== canonicalParam) {
                const localePrefix = locale === 'en' ? '/en' : ''
                const query = { ...context.query }
                delete query.id
                return {
                    redirect: {
                        destination: `${localePrefix}${buildCollectionUrl(id, data?.slug)}${encodeQueryData(query)}`,
                        permanent: false
                    }
                }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return { props: { ...translations, collection: data, id } }
        }
)

export default CollectionPage
