import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AppLayout, PhotoGallery } from '@/components/shared'
import type { PhotoUploaderHandle } from '@/components/shared/photo-uploader'
import type { PhotoViewerState } from '@/components/shared/photo-viewer'
import { FileDropZone } from '@/components/ui'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import useClientOnly from '@/hooks/useClientOnly'
import { PlaceCollections } from '@/sections/collections'
import {
    PlaceAbout,
    PlaceActions,
    PlaceDescription,
    PlaceExplore,
    PlaceHero,
    PlaceLocation,
    PlaceReviews,
    PlaceVisitors
} from '@/sections/place'
import type { RelatedPlacesLocation } from '@/sections/place/place-explore'
import { getCategoryTitle } from '@/utils/categories'
import { isCrawler } from '@/utils/crawler'
import { haversineDistanceKm } from '@/utils/geo'
import {
    buildPlacesHref,
    buildPlaceUrl,
    formatDateISO,
    formatDateUTC,
    getLandingFlags,
    removeMarkdown,
    truncateText
} from '@/utils/helpers'
import { buildPlaceAddress, getPlaceSchemaType } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'

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

export interface PlacePageProps {
    ratingCount: number
    place?: ApiModel.Place
    photoList?: ApiModel.Photo[]
    nearPlaces?: ApiModel.PlaceListItem[] | null
    /** "Ещё {category}: {region}" — the same category in the place's region (null without a region) */
    relatedPlaces?: ApiModel.PlaceListItem[] | null
    relatedLocation?: RelatedPlacesLocation | null
}

/**
 * The page body, keyed by the place in `PlacePage` below: Next reuses the page component
 * between `/places/[id]` routes, and none of this state (cover hash, local photos, open
 * dialogs, the sections' own state) may survive a move to a nearby place
 */
const PlacePageContent: React.FC<PlacePageProps> = ({
    ratingCount,
    place: cachedPlace,
    photoList,
    nearPlaces,
    relatedPlaces,
    relatedLocation
}) => {
    const { t, i18n } = useTranslation()

    const dispatch = useAppDispatch()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const userLocation = useAppSelector((state) => state.application.userLocation)
    const isClient = useClientOnly()

    const [views, setViews] = useState<number>()
    const [postView] = API.usePlacesPostViewMutation()

    // For guests the page is rendered once and served from the cache: the distance from the
    // visitor, the fresh view count and their own score come in the browser. The distance only
    // after hydration: the cached HTML has none (a signed-in user's server render has it)
    const place = useMemo(
        () =>
            cachedPlace && {
                ...cachedPlace,
                distance:
                    isClient && userLocation && cachedPlace.lat && cachedPlace.lon
                        ? Math.round(
                              haversineDistanceKm(userLocation, { lat: cachedPlace.lat, lon: cachedPlace.lon }) * 10
                          ) / 10
                        : cachedPlace.distance,
                views: views ?? cachedPlace.views
            },
        [cachedPlace, isClient, userLocation, views]
    )

    // The one request of the page: counts the view, answers the count and the visitor's score.
    // Not for crawlers that run scripts: no view to count, a write per page they render
    useEffect(() => {
        if (!cachedPlace?.id || navigator.webdriver || isCrawler(navigator.userAgent)) {
            return
        }

        const placeId = cachedPlace.id

        postView(placeId)
            .unwrap()
            .then(({ views: count, vote }) => {
                setViews(count)
                dispatch(
                    API.util.updateQueryData('ratingGetList', placeId, (draft) => {
                        draft.vote = vote
                    })
                )
            })
            .catch(() => undefined)
    }, [cachedPlace?.id, dispatch, postView])

    // Signed in on this page (it came from the guests' cache): the rating was the guest's one,
    // without their score. The live page of a signed-in user starts signed in and skips this
    const wasAuth = useRef(isAuth)

    useEffect(() => {
        if (isAuth === true && wasAuth.current !== true) {
            dispatch(API.util.invalidateTags([{ type: 'Rating' }]))
        }

        wasAuth.current = isAuth
    }, [dispatch, isAuth])

    const inputFileRef = useRef<HTMLInputElement>(null)
    const uploaderRef = useRef<PhotoUploaderHandle>(null)

    const [coverEditorOpen, setCoverEditorOpen] = useState<boolean>(false)
    const [coverHash, setCoverHash] = useState<number | undefined>()
    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>(photoList ?? [])
    const [uploadingPhotos, setUploadingPhotos] = useState<string[]>()
    const [nearbyPhotosOpen, setNearbyPhotosOpen] = useState<boolean>(false)
    // The photo viewer: "+N" and the tiles of the mosaic, the phone carousel and its counter
    const [photoViewer, setPhotoViewer] = useState<PhotoViewerState>(null)

    const landingFlags = getLandingFlags()
    // The most specific level of the place's address — same pairing as the visible
    // breadcrumbs (PlaceHero): "category" links to the location × category landing page.
    const mostSpecificAddress =
        place?.address?.locality ?? place?.address?.district ?? place?.address?.region ?? place?.address?.country

    // Only our own photos go to the structured data and the link previews, not the linked ones
    const ownPhotos = useMemo(() => photoList?.filter(({ external }) => !external), [photoList])

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const placePath = buildPlaceUrl(place?.id ?? '', place?.slug)
    const pagePlaceUrl = `${canonicalUrl}${placePath.replace(/^\//, '')}`
    // A place with no text in the interface locale shows its original: that page is no language
    // version of its own, so it is noindex, canonicalises to the original and gets no hreflang pair
    const isUntranslated = !!place?.locale && place.locale !== i18n.language
    const originalPlaceUrl = SITE_LINK + (place?.locale === 'en' ? 'en/' : '') + placePath.replace(/^\//, '')

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
                              item: `${canonicalUrl}${buildPlacesHref(
                                  {
                                      category: place.category,
                                      defaultOrder: ApiType.SortOrders.DESC,
                                      defaultSort: ApiType.SortFields.Trending,
                                      // The pair page only when it exists: with the flags off the crumb
                                      // is the plain category listing, as before the landing pages
                                      location:
                                          landingFlags.combinations &&
                                          mostSpecificAddress?.id &&
                                          mostSpecificAddress.type
                                              ? {
                                                    id: mostSpecificAddress.id,
                                                    slug: mostSpecificAddress.slug,
                                                    type: mostSpecificAddress.type
                                                }
                                              : null
                                  },
                                  landingFlags
                              ).href.replace(/^\//, '')}`,
                              name: getCategoryTitle(t, place.category),
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
            '@type': getPlaceSchemaType(place?.category),
            '@id': pagePlaceUrl,
            address: buildPlaceAddress(place?.address),
            aggregateRating: ratingCount
                ? {
                      '@type': 'AggregateRating',
                      bestRating: '5',
                      ratingCount: ratingCount,
                      ratingValue: String(place?.rating),
                      worstRating: '1'
                  }
                : undefined,
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
        [pagePlaceUrl, ownPhotos, place, ratingCount]
    )

    // The page about the place carries the author and the dates (CreativeWork properties, not a Place's)
    const webPageSchema = useMemo(
        () => ({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': `${pagePlaceUrl}#page`,
            about: { '@id': pagePlaceUrl },
            author: place?.author
                ? {
                      '@type': 'Person',
                      image: place.author.avatar ? `${IMG_HOST}${place.author.avatar}` : undefined,
                      name: place.author.name,
                      url: `${canonicalUrl}users/${place.author.id}`
                  }
                : undefined,
            dateModified: formatDateISO(place?.updated?.date) || undefined,
            datePublished: formatDateISO(place?.created?.date) || undefined,
            name: place?.title,
            url: pagePlaceUrl
        }),
        [canonicalUrl, pagePlaceUrl, place]
    )

    useEffect(() => {
        setLocalPhotos(photoList ?? [])
    }, [photoList])

    const placeDescription = truncateText(removeMarkdown(place?.content)?.replace(/\n/g, ' '), 155) || place?.title

    const actionsProps = {
        place,
        placeUrl: pagePlaceUrl,
        onChangePlaceCoverClick: handleEditPlaceCoverClick,
        onNearbyPhotosClick: () => setNearbyPhotosOpen(true),
        onPhotoUploadClick: handleUploadPhotoClick
    }

    return (
        <AppLayout
            bottomBar={
                <PlaceActions
                    {...actionsProps}
                    variant={'bar'}
                />
            }
        >
            <Head>
                {generateNextSeo({
                    title: place?.title,
                    description: placeDescription,
                    canonical: isUntranslated ? originalPlaceUrl : pagePlaceUrl,
                    noindex: isUntranslated,
                    nofollow: false,
                    openGraph: {
                        article: {
                            authors: [`${SITE_LINK}users/${place?.author?.id}`],
                            modifiedTime: formatDateUTC(place?.updated?.date),
                            publishedTime: formatDateUTC(place?.created?.date),
                            section: place?.category ? getCategoryTitle(t, place.category) : undefined
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
                        locale: (place?.locale ?? i18n.language) === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: place?.title,
                        type: 'article',
                        url: isUntranslated ? originalPlaceUrl : pagePlaceUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(placePath.replace(/^\//, ''), '', place?.locales)
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
            <JsonLdScript
                scriptKey={'place-page-schema'}
                data={webPageSchema}
            />

            <div>
                <PlaceHero
                    place={place}
                    photos={localPhotos}
                    coverHash={coverHash}
                    actions={
                        <PlaceActions
                            {...actionsProps}
                            variant={'toolbar'}
                        />
                    }
                    onPhotoUploadClick={handleUploadPhotoClick}
                    onAllPhotosClick={() => setPhotoViewer({ index: 0, mode: 'grid' })}
                    onPhotoClick={(index) => setPhotoViewer({ index, mode: 'single' })}
                />

                {/* Two columns on desktop: the reading column and the sticky "Где это" card. On
                    phones the main column dissolves (display: contents) and the card comes right
                    after the text: read → see where → go (DESIGN.md → Place page) */}
                <div className={styles.pageLayout}>
                    <div className={styles.mainColumn}>
                        <FileDropZone
                            className={cn(styles.orderPhotos, styles.photos)}
                            label={t('photo-drop-label', {
                                defaultValue: 'Перетащите фотографии сюда, чтобы загрузить'
                            })}
                            hint={t('photo-drop-hint', { defaultValue: 'JPG, PNG, GIF или WEBP, до 10 МБ' })}
                            onDrop={handleDropPhotos}
                        >
                            <PhotoGallery
                                variant={'mosaic'}
                                title={t('place-photos-title', {
                                    title: place?.title,
                                    defaultValue: 'Фотографии места «{{title}}»'
                                })}
                                photos={localPhotos}
                                // Without a cover the first photo is the LCP element of desktop
                                priority={!place?.cover}
                                uploadingPhotos={uploadingPhotos}
                                viewer={photoViewer}
                                onViewerChange={setPhotoViewer}
                                onPhotoDelete={setLocalPhotos}
                                onPhotoUploadClick={() => handleUploadPhotoClick(undefined)}
                            />
                        </FileDropZone>

                        <div className={styles.orderText}>
                            <PlaceDescription
                                placeId={place?.id}
                                content={place?.content}
                                locale={place?.locale}
                            />
                        </div>

                        <div className={styles.orderReviews}>
                            <PlaceReviews
                                placeId={place?.id}
                                authorId={place?.author?.id}
                            />
                        </div>

                        <div className={styles.orderExplore}>
                            <PlaceExplore
                                nearPlaces={nearPlaces}
                                relatedPlaces={relatedPlaces}
                                category={place?.category}
                                location={relatedLocation}
                                lat={place?.lat}
                                lon={place?.lon}
                            />
                        </div>

                        <div className={styles.orderAbout}>
                            <PlaceAbout
                                place={place}
                                photosCount={localPhotos.length}
                            />
                        </div>
                    </div>

                    <aside className={styles.sidebar}>
                        <PlaceLocation
                            place={place}
                            nearPlaces={nearPlaces}
                        >
                            <PlaceVisitors placeId={place?.id} />
                            <PlaceCollections placeId={place?.id} />
                        </PlaceLocation>
                    </aside>
                </div>
            </div>

            {nearbyPhotosOpen && place?.id && (
                <NearbyPhotosDialog
                    place={{ id: place.id, lat: place.lat, lon: place.lon, title: place.title }}
                    open={true}
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

/**
 * The place page, served two ways with the same props (`loadPlacePage`): from the Next cache to
 * guests and crawlers (`pages/places/[id]/index.tsx`), rendered on each request for a signed-in
 * user (`pages/places/[id]/live.tsx`, the proxy rewrites to it when the auth cookie is set)
 */
export const PlacePage: NextPage<PlacePageProps> = (props) => (
    <PlacePageContent
        key={props.place?.id}
        {...props}
    />
)
