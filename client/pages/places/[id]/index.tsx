import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { openAuthDialog, setLocale } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { AppLayout, PhotoGallery, PlaceCard } from '@/components/shared'
import type { PhotoUploaderHandle } from '@/components/shared/photo-uploader'
import { Carousel, FileDropZone } from '@/components/ui'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { PlaceCollections } from '@/sections/collections'
import {
    PlaceActionBar,
    PlaceActivity,
    PlaceCommentList,
    PlaceDescription,
    PlaceHero,
    PlaceInfoSidebar,
    PlaceVisited
} from '@/sections/place'
import {
    buildPlaceUrl,
    encodeQueryData,
    formatDateISO,
    formatDateUTC,
    parsePlaceId,
    removeMarkdown,
    truncateText
} from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

import styles from './styles.module.sass'

const PlaceCoverEditor = dynamic(
    () =>
        import('@/sections/place/place-cover-editor/PlaceCoverEditor').then((m) => ({
            default: m.PlaceCoverEditor
        })),
    { ssr: false }
)

const NearbyPhotosDialog = dynamic(
    () => import('@/components/shared/nearby-photos').then((m) => ({ default: m.NearbyPhotosDialog })),
    { ssr: false }
)

const PhotoUploader = dynamic(
    () => import('@/components/shared/photo-uploader/PhotoUploader').then((m) => ({ default: m.PhotoUploader })),
    { ssr: false }
)

const NEAR_PLACES_COUNT = 10

interface PlacePageProps {
    ratingCount: number
    place?: ApiModel.Place
    photoList?: ApiModel.Photo[]
    nearPlaces?: ApiModel.Place[] | null
}

const PlacePage: NextPage<PlacePageProps> = ({ ratingCount, place, photoList, nearPlaces }) => {
    const { t, i18n } = useTranslation()

    const dispatch = useAppDispatch()

    const inputFileRef = useRef<HTMLInputElement>(null)
    const uploaderRef = useRef<PhotoUploaderHandle>(null)

    const [coverEditorOpen, setCoverEditorOpen] = useState<boolean>(false)
    const [coverHash, setCoverHash] = useState<number | undefined>()
    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>(photoList ?? [])
    const [uploadingPhotos, setUploadingPhotos] = useState<string[]>()
    const [nearbyPhotosOpen, setNearbyPhotosOpen] = useState<boolean>(false)

    // Only our own photos go to the structured data and the link previews, not the linked ones
    const ownPhotos = useMemo(() => photoList?.filter(({ external }) => !external), [photoList])

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const placePath = buildPlaceUrl(place?.id ?? '', place?.slug)
    const pagePlaceUrl = `${canonicalUrl}${placePath.replace(/^\//, '')}`

    const handleSaveCover = () => {
        setTimeout(() => setCoverHash(Math.floor(Date.now() / 1000)), 400)
    }

    const handleEditPlaceCoverClick = () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        setCoverEditorOpen(true)
    }

    const handleUploadPhotoClick = (event: React.MouseEvent | undefined) => {
        event?.preventDefault()

        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            inputFileRef?.current?.click()
        }
    }

    const handleNearbyPhotosClick = () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            setNearbyPhotosOpen(true)
        }
    }

    const handleDropPhotos = (files: File[]) => {
        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            uploaderRef.current?.upload(files)
        }
    }

    const breadCrumbSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    item: canonicalUrl,
                    name: t('geotags'),
                    position: 1
                },
                {
                    '@type': 'ListItem',
                    item: `${canonicalUrl}places`,
                    name: t('interesting-places'),
                    position: 2
                },
                // Same trail as the visible breadcrumbs: places › category › place
                ...(place?.category
                    ? [
                          {
                              '@type': 'ListItem',
                              item: `${canonicalUrl}places?category=${place.category.name}`,
                              name: place.category.title,
                              position: 3
                          }
                      ]
                    : []),
                {
                    '@type': 'ListItem',
                    item: pagePlaceUrl,
                    name: place?.title,
                    position: place?.category ? 4 : 3
                }
            ]
        }),
        [canonicalUrl, pagePlaceUrl, place?.title, place?.category, t]
    )

    const placeSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': ['TouristAttraction', 'LocalBusiness'],
            '@id': pagePlaceUrl,
            address: {
                '@type': 'PostalAddress',
                addressCountry: place?.address?.country?.name
                    ? { '@type': 'Country', name: place.address.country.name }
                    : undefined,
                addressLocality: place?.address?.locality?.name,
                addressRegion: place?.address?.region?.name,
                streetAddress: place?.address?.street
            },
            aggregateRating: ratingCount
                ? {
                      '@type': 'AggregateRating',
                      bestRating: '5',
                      ratingCount: ratingCount,
                      ratingValue: String(place?.rating),
                      worstRating: '1'
                  }
                : undefined,
            author: {
                '@type': 'Person',
                image: place?.author?.avatar ? `${IMG_HOST}${place?.author?.avatar}` : undefined,
                name: place?.author?.name,
                url: `${canonicalUrl}users/${place?.author?.id}`
            },
            dateModified: formatDateISO(place?.updated?.date),
            datePublished: formatDateISO(place?.created?.date),
            description: removeMarkdown(place?.content),
            geo: {
                '@type': 'GeoCoordinates',
                latitude: place?.lat,
                longitude: place?.lon
            },
            image: (() => {
                const imgs = [
                    ...(place?.cover ? [`${IMG_HOST}${place.cover.full}`] : []),
                    ...(ownPhotos?.map(({ full }) => `${IMG_HOST}${full}`) ?? [])
                ]
                return imgs.length ? imgs : undefined
            })(),
            interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/ViewAction',
                userInteractionCount: place?.views
            },
            name: place?.title,
            url: pagePlaceUrl
        }),
        [canonicalUrl, pagePlaceUrl, ownPhotos, place, ratingCount]
    )

    useEffect(() => {
        setLocalPhotos(photoList ?? [])
    }, [photoList])

    const placeDescription = truncateText(removeMarkdown(place?.content)?.replace(/\n/g, ' '), 155) || place?.title

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: place?.title,
                    description: placeDescription,
                    canonical: pagePlaceUrl,
                    openGraph: {
                        article: {
                            authors: [`${SITE_LINK}users/${place?.author?.id}`],
                            modifiedTime: formatDateUTC(place?.updated?.date),
                            publishedTime: formatDateUTC(place?.created?.date),
                            section: place?.category?.title,
                            tags: place?.tags
                        },
                        description: placeDescription,
                        images: [
                            ...(place?.cover
                                ? [
                                      {
                                          alt: place.title || '',
                                          url: `${IMG_HOST}${place.cover.full}`
                                      }
                                  ]
                                : []),
                            ...(ownPhotos?.slice(0, 3).map((photo, index) => ({
                                alt: `${photo.title} (${index + 1})`,
                                height: photo.height,
                                url: `${IMG_HOST}${photo.full}`,
                                width: photo.width
                            })) ?? [])
                        ],
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: place?.title,
                        type: 'article',
                        url: pagePlaceUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(placePath.replace(/^\//, ''))
                })}
            </Head>

            <JsonLdScript
                scriptKey={'place-breadcrumb'}
                data={breadCrumbSchema}
            />
            <JsonLdScript
                scriptKey={'place-schema'}
                data={placeSchema}
            />

            <PlaceHero
                place={place}
                coverHash={coverHash}
                onChangePlaceCoverClick={handleEditPlaceCoverClick}
                onPhotoUploadClick={handleUploadPhotoClick}
            />

            <div className={styles.pageLayout}>
                <div className={styles.mainColumn}>
                    <PlaceActionBar
                        placeId={place?.id}
                        placeUrl={pagePlaceUrl}
                        bookmarks={place?.bookmarks}
                        verificationExempt={place?.verificationExempt}
                    />

                    <PlaceDescription
                        placeId={place?.id}
                        content={place?.content}
                        tags={place?.tags}
                    />

                    <FileDropZone
                        label={t('photo-drop-label', { defaultValue: 'Перетащите фотографии сюда, чтобы загрузить' })}
                        hint={t('photo-drop-hint', { defaultValue: 'JPG, PNG, GIF или WEBP, до 10 МБ' })}
                        onDrop={handleDropPhotos}
                    >
                        <PhotoGallery
                            title={t('photos')}
                            photos={localPhotos}
                            uploadingPhotos={uploadingPhotos}
                            onPhotoDelete={setLocalPhotos}
                            action={
                                <>
                                    <Button
                                        mode={'link'}
                                        onClick={handleNearbyPhotosClick}
                                    >
                                        {t('nearby-photos_title', { defaultValue: 'Фото рядом' })}
                                    </Button>
                                    <Button
                                        mode={'link'}
                                        onClick={handleUploadPhotoClick}
                                    >
                                        {t('upload-photo')}
                                    </Button>
                                </>
                            }
                        />
                    </FileDropZone>

                    <Container title={t('comments-title')}>
                        <PlaceCommentList placeId={place?.id} />
                    </Container>

                    <PlaceActivity
                        placeId={place?.id}
                        hidePlaceName={true}
                        hideCover={true}
                    />
                </div>

                <aside className={styles.sidebar}>
                    <PlaceInfoSidebar place={place} />
                    <PlaceCollections placeId={place?.id} />
                    <PlaceVisited place={place} />
                </aside>
            </div>

            {!!nearPlaces?.length && (
                <div className={styles.nearPlaces}>
                    <Carousel options={{ dragFree: true, loop: true }}>
                        {nearPlaces.map((nearPlace) => (
                            <PlaceCard
                                key={nearPlace.id}
                                place={nearPlace}
                            />
                        ))}
                    </Carousel>

                    <Button
                        size={'medium'}
                        mode={'secondary'}
                        noIndex={true}
                        stretched={true}
                        link={`/places?lat=${place?.lat}&lon=${place?.lon}&sort=distance&order=ASC`}
                    >
                        {t('all-places-nearby')}
                    </Button>
                </div>
            )}

            {place?.id && (
                <NearbyPhotosDialog
                    place={{ id: place.id, lat: place.lat, lon: place.lon, title: place.title }}
                    open={nearbyPhotosOpen}
                    onClose={() => setNearbyPhotosOpen(false)}
                    // Newest first, like the gallery from the server
                    onLink={(photo) => setLocalPhotos((photos) => [photo, ...photos])}
                    onUnlink={(linkId) => setLocalPhotos((photos) => photos.filter(({ id }) => id !== linkId))}
                />
            )}

            <PlaceCoverEditor
                placeId={place?.id}
                open={coverEditorOpen}
                onClose={() => setCoverEditorOpen(false)}
                onSaveCover={handleSaveCover}
            />

            <PhotoUploader
                placeId={place?.id}
                fileInputRef={inputFileRef}
                uploaderRef={uploaderRef}
                onSelectFiles={setUploadingPhotos}
                onUploadPhoto={(photo) => setLocalPhotos((prev) => [photo, ...prev])}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlacePageProps>> => {
            const rawParam = typeof context.params?.id === 'string' ? context.params.id : undefined
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            if (typeof rawParam !== 'string') {
                return { notFound: true }
            }

            // The route param may be the bare id or the SEO-friendly `{id}-{slug}` form; the
            // API itself is always called with the bare id.
            const id = parsePlaceId(rawParam)

            if (!id) {
                return { notFound: true }
            }

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: placeData, isError } = await store.dispatch(API.endpoints.placesGetItem.initiate({ id }))

            if (isError) {
                return { notFound: true }
            }

            // Redirect to the canonical `{id}` / `{id}-{slug}` URL when the requested param
            // doesn't match it (missing slug, stale slug, or a bare id for a place that now has
            // one). An empty/missing slug always canonicalises to the bare id, so this cannot loop.
            const canonicalParam = placeData?.slug ? `${id}-${placeData.slug}` : id

            if (rawParam !== canonicalParam) {
                const localePrefix = locale === 'en' ? '/en' : ''
                const query = { ...context.query }
                delete query.id
                const queryString = encodeQueryData(query)

                return {
                    redirect: {
                        destination: `${localePrefix}${buildPlaceUrl(id, placeData?.slug)}${queryString}`,
                        // Permanent (301) redirect: the canonical `{id}-{slug}` URL never changes for a
                        // given place, so search engines (Yandex in particular) should consolidate
                        // ranking signals onto it instead of re-crawling the old URL as a separate page.
                        statusCode: 301
                    }
                }
            }

            const [{ data: ratingData }, { data: photosData }, { data: _commentsData }, { data: nearPlaces }] =
                await Promise.all([
                    store.dispatch(API.endpoints.ratingGetList.initiate(id)),
                    store.dispatch(API.endpoints.photosGetList.initiate({ place: id })),
                    store.dispatch(API.endpoints.commentsGetList.initiate({ place: id })),
                    store.dispatch(
                        API.endpoints.placesGetList.initiate({
                            excludePlaces: [id],
                            lat: placeData?.lat,
                            limit: NEAR_PLACES_COUNT,
                            lon: placeData?.lon,
                            order: ApiType.SortOrders.ASC,
                            sort: ApiType.SortFields.Distance
                        })
                    )
                ])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    nearPlaces: nearPlaces?.items ?? null,
                    photoList: photosData?.items,
                    place: placeData,
                    ratingCount: ratingData?.count ?? 0
                }
            }
        }
)

export default PlacePage
