import React, { useEffect, useMemo, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { AppLayout } from '@/components/shared'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
    CollectionDescription,
    CollectionHeader,
    CollectionMap,
    CollectionPlacesList,
    CollectionSettingsDialog
} from '@/sections/collections'
import { getErrorMessage } from '@/utils/api'
import {
    buildCollectionUrl,
    buildPlaceUrl,
    encodeQueryData,
    formatDateISO,
    parseCollectionId,
    removeMarkdown,
    truncateText
} from '@/utils/helpers'

import styles from '@/sections/collections/styles.module.sass'

// Owner-only dialog with search, recommendations and image rows — not needed in the SSR bundle
const AddPlacesDialog = dynamic(
    () =>
        import('@/sections/collections/add-places-dialog/AddPlacesDialog').then((m) => ({
            default: m.AddPlacesDialog
        })),
    { ssr: false }
)

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface CollectionPageProps {
    id: string
    collection?: ApiModel.Collection
}

const CollectionPage: NextPage<CollectionPageProps> = ({ id, collection: initialCollection }) => {
    const { t, i18n } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()

    // The SSR result is already in the hydrated RTK cache, so this subscribes to it without
    // a second request and re-renders when a mutation (add / remove / reorder) invalidates it.
    const { data: liveCollection } = API.useCollectionsGetItemQuery(id, { skip: !id })
    const collection = liveCollection ?? initialCollection
    const userId = useAppSelector((state) => state.auth.user?.id)

    const [reorderPlaces] = API.useCollectionsReorderPlacesMutation()
    const [removePlace] = API.useCollectionsRemovePlaceMutation()
    const [patchCollection, { isLoading: descriptionSaving }] = API.useCollectionsPatchMutation()
    const [deleteCollection, { isLoading: deleteLoading }] = API.useCollectionsDeleteMutation()

    const [editMode, setEditMode] = useState(false)
    // Description draft while in edit mode; saved by the header's "Готово", dropped by "Отмена"
    const [descriptionDraft, setDescriptionDraft] = useState('')
    const [addOpen, setAddOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

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

    // Place edits (order, removal) are saved as they happen; only the description draft can be lost
    const descriptionChanged = editMode && descriptionDraft.trim() !== (collection?.description ?? '').trim()
    const {
        allowNavigation,
        confirmDiscard,
        dialogProps: leaveDialogProps
    } = useUnsavedChangesGuard(descriptionChanged)

    // Leaving the collection (or losing ownership) always leaves edit mode
    useEffect(() => {
        setEditMode(false)
    }, [collection?.id, isOwner])

    const notifyIfError = (result: { error?: unknown }) => {
        if ('error' in result && result.error) {
            void dispatch(Notify({ id: 'collectionPageError', message: getErrorMessage(result.error), type: 'error' }))
        }
    }

    const handleReorder = async (order: string[]) => {
        if (collection) {
            notifyIfError(await reorderPlaces({ id: collection.id, order }))
        }
    }

    const handleRemove = async (placeId: string) => {
        if (collection) {
            notifyIfError(await removePlace({ id: collection.id, placeId }))
        }
    }

    const handleEdit = () => {
        setDescriptionDraft(collection?.description ?? '')
        setEditMode(true)
    }

    const handleCancelEdit = () =>
        confirmDiscard(() => {
            setDescriptionDraft(collection?.description ?? '')
            setEditMode(false)
        })

    // "Готово": save the description if it changed, then leave edit mode. Place edits
    // (order, removal) are already saved as they happen.
    const handleDone = async () => {
        if (!collection) {
            return
        }

        const description = descriptionDraft.trim() || null

        if (description !== (collection.description ?? null)) {
            const result = await patchCollection({ description, id: collection.id })

            if ('error' in result && result.error) {
                notifyIfError(result)
                return
            }

            void dispatch(
                Notify({
                    id: 'collectionDescriptionSaved',
                    title: '',
                    message: t('collections_saved', { defaultValue: 'Изменения сохранены' }),
                    type: 'success'
                })
            )
        }

        setEditMode(false)
    }

    const handleDelete = async () => {
        if (!collection) {
            return
        }

        const result = await deleteCollection(collection.id)
        notifyIfError(result)

        if (!('error' in result)) {
            setDeleteOpen(false)
            setSettingsOpen(false)
            allowNavigation()
            await router.push('/collections')
        }
    }

    // The meta description is the start of the article: there is no separate SEO field
    const description = truncateText(removeMarkdown(collection?.description ?? undefined)?.replace(/\n/g, ' '), 160)

    const coverUrl = collection?.cover?.full ? `${IMG_HOST}${collection.cover.full}` : undefined

    const itemListSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            author: collection?.author
                ? {
                      '@type': 'Person',
                      image: collection.author.avatar ? `${IMG_HOST}${collection.author.avatar}` : undefined,
                      name: collection.author.name,
                      url: `${canonicalUrl}users/${collection.author.id}`
                  }
                : undefined,
            dateModified: formatDateISO(collection?.updated?.date) || undefined,
            datePublished: formatDateISO(collection?.created?.date) || undefined,
            description: description || undefined,
            image: coverUrl,
            mainEntity: {
                '@type': 'ItemList',
                itemListElement: (collection?.places ?? []).map((place, index) => ({
                    '@type': 'ListItem',
                    item: {
                        '@type': 'TouristAttraction',
                        geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lon },
                        image: place.cover?.full ? `${IMG_HOST}${place.cover.full}` : undefined,
                        name: place.title,
                        url: `${canonicalUrl}${buildPlaceUrl(place.id, place.slug).replace(/^\//, '')}`
                    },
                    position: index + 1
                })),
                numberOfItems: collection?.places?.length ?? 0
            },
            name: collection?.title,
            url: canonicalPageUrl
        }),
        [canonicalPageUrl, canonicalUrl, collection, coverUrl, description]
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

    const mapPlaces = useMemo(
        () =>
            (collection?.places ?? []).map((place) => ({
                id: place.id,
                lat: place.lat,
                lon: place.lon,
                category: place.category
            })),
        [collection?.places]
    )

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('collections_seo-title', {
                        count: collection?.placesCount,
                        defaultValue: '{{title}}: {{count}} мест на карте с фото',
                        title: collection?.title
                    }),
                    description,
                    canonical: canonicalPageUrl,
                    noindex: !collection?.indexable || i18n.language === 'en',
                    nofollow: false,
                    openGraph: {
                        description,
                        images: coverUrl ? [{ alt: collection?.title, url: coverUrl }] : undefined,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: collection?.title,
                        type: 'website',
                        url: pageUrl
                    },
                    twitter: { cardType: 'summary_large_image' }
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

            <CollectionHeader
                collection={collection}
                isOwner={isOwner}
                editMode={editMode}
                saving={descriptionSaving}
                onEdit={handleEdit}
                onDone={() => void handleDone()}
                onCancel={handleCancelEdit}
                onOpenSettings={() => setSettingsOpen(true)}
                onDelete={() => setDeleteOpen(true)}
            />

            {!!mapPlaces.length && (
                <Container className={styles.articleMap}>
                    <div className={styles.articleMapInner}>
                        <CollectionMap places={mapPlaces} />
                    </div>
                </Container>
            )}

            {(editMode || !!collection?.description) && (
                <CollectionDescription
                    description={collection?.description}
                    editable={editMode}
                    draft={descriptionDraft}
                    saving={descriptionSaving}
                    onChange={setDescriptionDraft}
                />
            )}

            <div>
                <CollectionPlacesList
                    places={collection?.places ?? []}
                    editable={editMode}
                    canAdd={isOwner}
                    onReorder={handleReorder}
                    onRemove={handleRemove}
                    onAddPlaces={() => setAddOpen(true)}
                />
            </div>

            {isOwner && collection && (
                <>
                    <AddPlacesDialog
                        collection={collection}
                        open={addOpen}
                        onClose={() => setAddOpen(false)}
                    />

                    <CollectionSettingsDialog
                        collection={collection}
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onDelete={() => setDeleteOpen(true)}
                    />

                    <ConfirmationDialog
                        open={deleteOpen}
                        message={t('collections_delete-confirm', {
                            defaultValue:
                                'Удалить коллекцию «{{title}}»? Места останутся на сайте, но подборка исчезнет.',
                            title: collection.title
                        })}
                        confirmLabel={
                            deleteLoading
                                ? t('collections_deleting', { defaultValue: 'Удаление…' })
                                : t('collections_delete-collection', { defaultValue: 'Удалить коллекцию' })
                        }
                        onConfirm={() => void handleDelete()}
                        onCancel={() => setDeleteOpen(false)}
                    />
                </>
            )}

            <ConfirmationDialog {...leaveDialogProps} />
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

            const { data, error } = await store.dispatch(API.endpoints.collectionsGetItem.initiate(id))

            if (error) {
                if ('status' in error && error.status === 404) {
                    return { notFound: true }
                }

                // Anything else is a failing API, not a missing collection — surface it
                // as a server error instead of a misleading 404 page.
                throw new Error(`Failed to load collection ${id}: ${JSON.stringify(error)}`)
            }

            const canonicalParam = data?.slug ? `${id}-${data.slug}` : id

            if (rawParam !== canonicalParam) {
                const localePrefix = locale === 'en' ? '/en' : ''
                const query = { ...context.query }
                delete query.id
                return {
                    redirect: {
                        destination: `${localePrefix}${buildCollectionUrl(id, data?.slug)}${encodeQueryData(query)}`,
                        // Permanent (301) redirect: the canonical `{id}-{slug}` URL never changes for a
                        // given collection, so search engines (Yandex in particular) should consolidate
                        // ranking signals onto it instead of re-crawling the old URL as a separate page.
                        statusCode: 301
                    }
                }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return { props: { ...translations, collection: data, id } }
        }
)

export default CollectionPage
