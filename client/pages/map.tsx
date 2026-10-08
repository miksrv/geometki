import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLngBounds, LatLngExpression } from 'leaflet'
import debounce from 'lodash-es/debounce'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { openAuthDialog, setLocale } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { getMapSettings, saveMapSettings } from '@/components/map/mapSettings'
import { AppLayout, MapObjectsTypeEnum } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { round } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
    ssr: false
})

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

// Experiment to enable/disable POI clusterization on the map
const ENABLE_POI_CLUSTERIZATION = false

const MapPage: NextPage<object> = () => {
    const { t, i18n } = useTranslation()

    const router = useRouter()
    const dispatch = useAppDispatch()

    const location = useAppSelector((state) => state.application.userLocation)
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [initMapCoords, setInitMapCoords] = useState<LatLngExpression>()
    const [initMapZoom, setInitMapZoom] = useState<number>()
    // const [initMapLayer, setInitMapLayer] = useState<MapLayersType>()

    const [showLightbox, setShowLightbox] = useState<boolean>(false)
    const [photoIndex, setPhotoIndex] = useState<number>()
    const [photoLightbox, setPhotoLightbox] = useState<ApiModel.PhotoMark[]>()
    // mapCategories: debounced value sent to the API; categories: immediate UI state
    const [categories, setCategories] = useState<ApiModel.Categories[]>()
    const [mapCategories, setMapCategories] = useState<ApiModel.Categories[]>()
    const [mapType, setMapType] = useState<MapObjectsTypeEnum>()
    const [mapBounds, setMapBounds] = useState<string>()
    const [mapZoom, setMapZoom] = useState<number>()

    const mapSetHashRef = useRef<string>('')

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const { data: poiListData, isFetching: placesLoading } = API.usePoiGetListQuery(
        {
            bounds: ENABLE_POI_CLUSTERIZATION ? mapBounds : undefined,
            cluster: ENABLE_POI_CLUSTERIZATION,
            categories: mapCategories ?? [],
            zoom: ENABLE_POI_CLUSTERIZATION ? mapZoom : undefined
        },
        { skip: (ENABLE_POI_CLUSTERIZATION && !mapBounds) || mapType !== 'Places' }
    )

    const { data: photoListData, isFetching: photosLoading } = API.usePoiGetPhotoListQuery(
        { bounds: mapBounds, zoom: mapZoom, cluster: true },
        { skip: !mapBounds || mapType !== 'Photos' }
    )

    const handleCloseLightbox = () => {
        setShowLightbox(false)
    }

    const handlePhotoClick = (photos: ApiModel.PhotoMark[], index?: number) => {
        setPhotoLightbox(photos)
        setPhotoIndex(index ?? 0)
        setShowLightbox(true)
    }

    const updateUrlCoordinates = async (lat?: number, lon?: number, zoom?: number) => {
        const url = new URL(window.location.href)
        const hash = url.hash

        if (!lat || !lon) {
            return
        }

        const match = hash.match(/#([\d.]+),([\d.]+),(\d+)/)

        if (match) {
            url.hash = hash.replace(/#[^?]*/, `#${lat},${lon},${zoom}`)
        } else {
            url.hash = `#${lat},${lon},${zoom}`
        }

        mapSetHashRef.current = `${lat},${lon},${zoom}`
        await router.replace(url.toString())
    }

    const debounceSetMapBounds = useCallback(
        debounce(async (bounds: LatLngBounds, zoom: number) => {
            const mapCenter = bounds.getCenter()
            const lat = round(mapCenter.lat, 4)
            const lon = round(mapCenter.lng, 4)

            await updateUrlCoordinates(lat, lon, zoom)

            setMapBounds(bounds.toBBoxString())
            setMapZoom(zoom)
        }, 500),
        []
    )

    const debounceSetMapCategories = useCallback(
        debounce((categories?: ApiModel.Categories[]) => {
            setMapCategories(categories)
        }, 1000),
        []
    )

    const handleCreatePlace = async () => {
        if (isAuth) {
            await router.push('/places/create')
        } else {
            dispatch(openAuthDialog())
        }
    }

    const handleChangeCategories = (categories?: ApiModel.Categories[]) => {
        setCategories(categories)
        debounceSetMapCategories(categories)
        saveMapSettings({ categories: categories ?? [] })
    }

    // After the mount: the page is rendered on the server too, where there is no localStorage
    useEffect(() => {
        const initialCategories = getMapSettings().categories ?? Object.values(ApiModel.Categories)

        setCategories(initialCategories)
        setMapCategories(initialCategories)
    }, [])

    useEffect(() => {
        const hashIndex = router.asPath.indexOf('#')

        if (hashIndex === -1) {
            return
        }

        const hash = router.asPath.slice(hashIndex + 1)
        const coordsPart = hash.split('?')[0]

        if (coordsPart === mapSetHashRef.current) {
            return
        }

        const splitCords = coordsPart.split(',')
        const lat = parseFloat(splitCords[0])
        const lon = parseFloat(splitCords[1])
        const zoom = parseFloat(splitCords[2])

        if (lat && lon) {
            setInitMapCoords([lat, lon])
        }

        if (zoom && Number(zoom) >= 6 && Number(zoom) <= 18) {
            setInitMapZoom(Number(zoom))
        }
    }, [router.asPath])

    return (
        <AppLayout
            fullSize={true}
            className={'mainLayout'}
        >
            <Head>
                {generateNextSeo({
                    title: t('map-of-interesting-pages'),
                    description: t('geotags-map-description'),
                    canonical: `${canonicalUrl}map`,
                    openGraph: {
                        description: t('geotags-map-description'),
                        images: [
                            {
                                alt: t('map-of-interesting-pages'),
                                height: 1305,
                                url: `${SITE_LINK}images/pages/map.jpg`,
                                width: 1730
                            }
                        ],
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: t('map-of-interesting-pages'),
                        type: 'website',
                        url: `${canonicalUrl}map`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('map')
                })}
            </Head>
            <JsonLdScript
                scriptKey={'map-app'}
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebApplication',
                    applicationCategory: 'TravelApplication',
                    description: t('geotags-map-description'),
                    name: t('map-of-interesting-pages'),
                    offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
                    operatingSystem: 'Web',
                    url: `${canonicalUrl}map`
                }}
            />

            {showLightbox && (
                <PhotoLightbox
                    photos={photoLightbox}
                    photoIndex={photoIndex}
                    showLightbox={showLightbox}
                    onCloseLightBox={handleCloseLightbox}
                />
            )}

            <div className={'mapContainer'}>
                <InteractiveMap
                    center={initMapCoords}
                    zoom={initMapZoom}
                    categories={categories}
                    // layer={initMapLayer}
                    storeMapPosition={true}
                    storeMapSettings={true}
                    enableCenterPopup={true}
                    // enableSearch={true}
                    enableFullScreen={true}
                    enableRuler={true}
                    enableAreaMeasure={true}
                    enableCoordsControl={true}
                    enableLayersSwitcher={true}
                    enableOsmCandidates={true}
                    enableContextMenu={true}
                    enableCategoryControl={mapType === 'Places'}
                    loading={placesLoading || photosLoading}
                    places={mapType === 'Places' ? poiListData?.items : []}
                    photos={mapType === 'Photos' ? photoListData?.items : []}
                    onPhotoClick={handlePhotoClick}
                    onChangeCategories={handleChangeCategories}
                    onClickCreatePlace={handleCreatePlace}
                    onChangeMapType={setMapType}
                    onChangeBounds={debounceSetMapBounds}
                    userLatLon={location}
                />
            </div>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations
                }
            }
        }
)

export default MapPage
