import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BreadcrumbList, LocalBusiness } from 'schema-dts'
import { Button, Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { openAuthDialog, setLocale } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { AppLayout, PhotoGallery, PhotoUploader, PlacesListItem } from '@/components/shared'
import { Carousel } from '@/components/ui'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import {
    ForwardedPlaceCoverEditor,
    PlaceCommentList,
    PlaceCoverEditorRefProps,
    PlaceDescription,
    PlaceHeader,
    PlaceInformation,
    PlaceShareButtons
} from '@/sections/place'
import { formatDateISO, formatDateUTC, removeMarkdown, truncateText } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

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

    const { data: commentListData, isLoading: commentListLoading } = API.useCommentsGetListQuery(
        {
            place: place?.id
        },
        { skip: !place?.id }
    )

    const placeCoverEditorRef = useRef<PlaceCoverEditorRefProps>(null)
    const inputFileRef = useRef<HTMLInputElement>(null)

    const [coverHash, setCoverHash] = useState<number | undefined>()
    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>(photoList ?? [])
    const [uploadingPhotos, setUploadingPhotos] = useState<string[]>()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pagePlaceUrl = `${canonicalUrl}places/${place?.id}`

    const handleSaveCover = () => {
        setTimeout(() => setCoverHash(Math.floor(Date.now() / 1000)), 400)
    }

    const handleEditPlaceCoverClick = () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        if (placeCoverEditorRef?.current) {
            placeCoverEditorRef.current?.handleChangeCoverClick({} as React.MouseEvent)
        }
    }

    const handleUploadPhotoClick = (event: React.MouseEvent | undefined) => {
        event?.preventDefault()

        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            inputFileRef?.current?.click()
        }
    }

    const breadCrumbSchema: unknown | BreadcrumbList = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    item: `${canonicalUrl}places`,
                    name: t('geotags'),
                    position: 1
                },
                {
                    '@type': 'ListItem',
                    item: pagePlaceUrl,
                    name: place?.title,
                    position: 2
                }
            ]
        }),
        [canonicalUrl, place?.title, t]
    )

    const placeSchema: unknown | LocalBusiness = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            address: {
                '@type': 'PostalAddress',
                addressCountry: place?.address?.country?.name,
                addressLocality: place?.address?.locality?.name,
                addressRegion: place?.address?.region?.name,
                streetAddress: place?.address?.street
            },
            aggregateRating: ratingCount
                ? {
                      '@type': 'AggregateRating',
                      bestRating: '5',
                      ratingCount: ratingCount ?? 0,
                      ratingValue: place?.rating,
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
            image: photoList?.length ? photoList.map(({ full }) => `${IMG_HOST}${full}`) : undefined,
            interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/ViewAction',
                userInteractionCount: place?.views
            },
            name: place?.title,
            url: pagePlaceUrl
        }),
        [canonicalUrl, pagePlaceUrl, photoList, place, ratingCount, t]
    )

    useEffect(() => {
        setLocalPhotos(photoList ?? [])
    }, [photoList])

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: place?.title,
                    description: truncateText(removeMarkdown(place?.content), 300),
                    canonical: pagePlaceUrl,
                    openGraph: {
                        article: {
                            authors: [`${SITE_LINK}users/${place?.author?.id}`],
                            modifiedTime: formatDateUTC(place?.updated?.date),
                            publishedTime: formatDateUTC(place?.created?.date),
                            section: place?.category?.name,
                            tags: place?.tags
                        },
                        description: truncateText(removeMarkdown(place?.content), 300),
                        images: photoList?.slice(0, 3).map((photo, index) => ({
                            alt: `${photo.title} (${index + 1})`,
                            height: photo.height,
                            url: `${IMG_HOST}${photo.full}`,
                            width: photo.width
                        })),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: place?.title,
                        type: 'article',
                        url: pagePlaceUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`places/${place?.id}`)
                })}
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify([breadCrumbSchema, placeSchema])
                    }}
                />
            </Head>

            <PlaceHeader
                place={place}
                coverHash={coverHash}
                onChangePlaceCoverClick={handleEditPlaceCoverClick}
                onPhotoUploadClick={handleUploadPhotoClick}
            />

            <PlaceInformation place={place} />

            <PlaceShareButtons
                placeId={place?.id}
                placeUrl={pagePlaceUrl}
            />

            <PhotoGallery
                title={t('photos')}
                photos={localPhotos}
                uploadingPhotos={uploadingPhotos}
                action={
                    <Button
                        mode={'link'}
                        onClick={handleUploadPhotoClick}
                    >
                        {t('upload-photo')}
                    </Button>
                }
            />

            <PlaceDescription
                placeId={place?.id}
                content={place?.content}
                tags={place?.tags}
            />

            <Container title={t('comments-title')}>
                <PlaceCommentList
                    placeId={place?.id}
                    comments={commentListData?.items}
                    loading={commentListLoading}
                />
            </Container>

            {!!nearPlaces?.length && (
                <>
                    <Carousel options={{ dragFree: true, loop: true }}>
                        {nearPlaces.map((place) => (
                            <PlacesListItem
                                t={t}
                                key={place.id}
                                place={place}
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
                </>
            )}

            <ForwardedPlaceCoverEditor
                ref={placeCoverEditorRef}
                placeId={place?.id}
                onSaveCover={handleSaveCover}
            />

            <PhotoUploader
                placeId={place?.id}
                fileInputRef={inputFileRef}
                onSelectFiles={setUploadingPhotos}
                onUploadPhoto={(photo) => {
                    setLocalPhotos([photo, ...localPhotos])
                }}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlacePageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: placeData, isError } = await store.dispatch(API.endpoints.placesGetItem.initiate({ id }))

            if (isError) {
                return { notFound: true }
            }

            const { data: ratingData } = await store.dispatch(API.endpoints.ratingGetList.initiate(id))
            const { data: photosData } = await store.dispatch(API.endpoints.photosGetList.initiate({ place: id }))
            const { data: nearPlaces } = await store.dispatch(
                API.endpoints.placesGetList.initiate({
                    excludePlaces: [id],
                    lat: placeData?.lat,
                    limit: NEAR_PLACES_COUNT,
                    lon: placeData?.lon,
                    order: ApiType.SortOrders.ASC,
                    sort: ApiType.SortFields.Distance
                })
            )

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
