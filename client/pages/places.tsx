import React, { useCallback, useMemo, useState } from 'react'
import type { BreadcrumbList } from 'schema-dts'
import { Button, Container, Dialog } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType, useAppDispatch } from '@/api'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { setLocale, toggleOverlay } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header, PlacesList } from '@/components/shared'
import { PlaceFilterPanel, PlacesFilterType } from '@/sections/place'
import { Pagination } from '@/components/ui'
import { LOCAL_STORAGE } from '@/config/constants'
import { encodeQueryData } from '@/utils/helpers'
import { PlaceSchema } from '@/utils/schema'

const DEFAULT_SORT = ApiType.SortFields.Updated
const DEFAULT_ORDER = ApiType.SortOrders.DESC
const POST_PER_PAGE = 21

// TODO: Rename categoriesData to categoriesList
interface PlacesPageProps {
    categoriesData: ApiModel.Category[]
    locationType: ApiType.LocationTypes | null
    locationData: ApiModel.AddressItem | null
    country: number | null
    region: number | null
    district: number | null
    locality: number | null
    category: string | null
    tag: string | null
    lat: number | null
    lon: number | null
    sort: ApiType.SortFieldsType
    order: ApiType.SortOrdersType
    currentPage: number
    placesCount: number
    placesList: ApiModel.Place[]
}

const PlacesPage: NextPage<PlacesPageProps> = ({
    categoriesData,
    locationType,
    locationData,
    country,
    region,
    district,
    locality,
    category,
    tag,
    lat,
    lon,
    sort,
    order,
    currentPage,
    placesCount,
    placesList
}) => {
    const { t, i18n } = useTranslation()

    const router = useRouter()
    const dispatch = useAppDispatch()

    const [filterOpenTitle, setFilterOpenTitle] = useState<string>('')
    const [filtersOptionsOpen, setFiltersOptionsOpen] = useState<boolean>(false)
    const [filtersDialogOpen, setFiltersDialogOpen] = useState<boolean>(false)

    const initialFilter: PlacesFilterType = {
        category: category ?? undefined,
        country: country ?? undefined,
        district: district ?? undefined,
        lat: lat ?? undefined,
        locality: locality ?? undefined,
        lon: lon ?? undefined,
        order: order !== DEFAULT_ORDER ? order : undefined,
        page: currentPage !== 1 ? currentPage : undefined,
        region: region ?? undefined,
        sort: sort !== DEFAULT_SORT ? sort : undefined,
        tag: tag ?? undefined
    }

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const canonicalPage = `${canonicalUrl}places${encodeQueryData({
        ...initialFilter,
        lat: undefined,
        lon: undefined,
        order: undefined,
        sort: undefined
    })}`

    const handleChangeFilter = useCallback(
        async (key: keyof PlacesFilterType, value: string | number | undefined) => {
            const filter = { ...initialFilter, [key]: value }
            const update = {
                category: filter.category ?? undefined,
                country: filter.country ?? undefined,
                district: filter.district ?? undefined,
                lat: filter.lat ?? undefined,
                locality: filter.locality ?? undefined,
                lon: filter.lon ?? undefined,
                order: filter.order !== DEFAULT_ORDER ? filter.order : undefined,
                page: filter.page !== 1 ? filter.page : undefined,
                region: filter.region ?? undefined,
                sort: filter.sort !== DEFAULT_SORT ? filter.sort : undefined,
                tag: filter.tag ?? undefined
            }

            if (
                (filter.category !== category ||
                    filter.country !== country ||
                    filter.district !== district ||
                    filter.region !== region ||
                    filter.locality !== locality) &&
                currentPage !== 1
            ) {
                update.page = undefined
            }

            setFiltersOptionsOpen(false)
            setFilterOpenTitle('')

            return await router.push('/places' + encodeQueryData(update))
        },
        [category, country, currentPage, district, initialFilter, locality, order, region, router, sort, tag]
    )

    const handleClearLocationFilter = async () => {
        const filter = {
            ...initialFilter,
            country: undefined,
            district: undefined,
            locality: undefined,
            region: undefined
        }

        return await router.push('/places' + encodeQueryData(filter))
    }

    const handleOpenFilterOptions = (filterTitle?: string) => {
        setFiltersOptionsOpen(true)
        setFilterOpenTitle(filterTitle || '')
    }

    const handleChangeLocation = async (location?: ApiModel.AddressItem) => {
        if (!location) {
            await handleClearLocationFilter()
        } else {
            await handleChangeFilter(location.type ?? 'locality', location.id)
        }
    }

    const currentCategory = categoriesData.find(({ name }) => name === category)?.title

    const title = useMemo(() => {
        const titleTag = tag ? ` #${tag}` : ''
        const titlePage = initialFilter.page && initialFilter.page > 1 ? ` - ${t('page')} ${initialFilter.page}` : ''

        if (!currentCategory && !locationType) {
            return t('interesting-places') + titleTag + titlePage
        }

        const titles = []

        if (locationType) {
            titles.push(locationData?.name)
        }

        if (currentCategory) {
            titles.push(currentCategory)
        }

        return `${t('interesting-places')}: ${titles.join(', ')}` + titleTag + titlePage
    }, [currentCategory, locationData, locationType, i18n.language, initialFilter])

    const breadcrumbsLinks = useMemo(() => {
        const breadcrumbs = []

        if (category || locationType || tag || currentPage > 1) {
            breadcrumbs.push({
                link: '/places',
                text: t('interesting-places')
            })
        }

        if (locationType && category) {
            breadcrumbs.push({
                link: `/places?${locationType}=${locationData?.id}`,
                text: locationData?.name ?? ''
            })
        }

        return breadcrumbs
    }, [category, locationData, locationType, tag, currentPage])

    const breadCrumbCurrent = category
        ? currentCategory
        : locationType
          ? locationData?.name
          : tag
            ? `#${tag}`
            : currentPage > 1
              ? `${t('page')} ${initialFilter.page}`
              : t('interesting-places')

    const filtersCount = useMemo(() => {
        let count = 0

        if (locationType) {
            count++
        }

        if (category) {
            count++
        }

        return count
    }, [category, locationType])

    const handleClickOpenFiltersDialog = () => {
        dispatch(toggleOverlay(true))
        setFiltersDialogOpen(true)
    }

    const handleFiltersDialogClose = () => {
        dispatch(toggleOverlay(false))
        setFiltersDialogOpen(false)
    }

    const handleFiltersBackLink = () => {
        setFiltersOptionsOpen(false)
        setFilterOpenTitle('')
    }

    const breadCrumbSchema: unknown | BreadcrumbList = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            ...(breadcrumbsLinks?.map((link, i) => ({
                '@type': 'ListItem',
                item: canonicalUrl + link.link,
                name: link.text,
                position: i + 1
            })) || []),
            {
                '@type': 'ListItem',
                name: breadCrumbCurrent,
                position: breadcrumbsLinks.length + 1
            }
        ]
    }

    return (
        <AppLayout>
            <Head>
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(breadCrumbSchema)
                    }}
                />
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(placesList.map((place) => PlaceSchema(place)))
                    }}
                />
            </Head>

            <NextSeo
                title={title}
                description={`${title} - ${placesList
                    ?.map(({ title }) => title)
                    ?.join(', ')
                    ?.substring(0, 220)}`}
                canonical={canonicalPage}
                openGraph={{
                    images: placesList
                        .filter(({ cover }) => cover?.full)
                        .map(({ cover, title }) => ({
                            alt: `${title}`,
                            height: 180,
                            url: `${IMG_HOST}${cover?.preview}`,
                            width: 280
                        })),
                    locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                    type: 'http://ogp.me/ns/article#'
                }}
            />

            <Header
                title={title}
                homePageTitle={t('geotags')}
                links={breadcrumbsLinks || []}
                currentPage={breadCrumbCurrent}
                actions={
                    <Button
                        size={'medium'}
                        mode={'primary'}
                        icon={'Tune'}
                        onClick={handleClickOpenFiltersDialog}
                    >
                        {t('filters')}
                        {filtersCount > 0 && ` (${filtersCount})`}
                    </Button>
                }
            />

            <PlacesList places={placesList} />

            <Container className={'paginationContainer'}>
                <div>
                    {t('geotags_count')} <strong>{placesCount}</strong>
                </div>
                <Pagination
                    currentPage={currentPage}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    totalItemsCount={placesCount}
                    perPage={POST_PER_PAGE}
                    urlParam={initialFilter}
                    linkPart={'places'}
                />
            </Container>

            <Dialog
                contentHeight={'306px'}
                title={filterOpenTitle || t('filters')}
                open={filtersDialogOpen}
                backLinkCaption={t('back')}
                showBackLink={filtersOptionsOpen}
                onBackClick={handleFiltersBackLink}
                onCloseDialog={handleFiltersDialogClose}
            >
                <PlaceFilterPanel
                    sort={sort}
                    order={order}
                    category={category}
                    optionsOpen={filtersOptionsOpen}
                    location={
                        locationData && locationType
                            ? {
                                  id: locationData.id,
                                  name: locationData.name,
                                  type: locationType
                              }
                            : undefined
                    }
                    onChange={handleChangeFilter}
                    onOpenOptions={handleOpenFilterOptions}
                    onChangeLocation={handleChangeLocation}
                />
            </Dialog>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlacesPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale

            const country = parseInt(context.query.country as string, 10) || null
            const region = parseInt(context.query.region as string, 10) || null
            const district = parseInt(context.query.district as string, 10) || null
            const locality = parseInt(context.query.locality as string, 10) || null

            const currentPage = parseInt(context.query.page as string, 10) || 1
            const category = (context.query.category as string) || null

            let lat = parseFloat(context.query.lat as string) || null
            let lon = parseFloat(context.query.lon as string) || null
            let isUserLocation = false

            const tag = (context.query.tag as string) || null
            const sort = (context.query.sort as ApiType.SortFieldsType) || DEFAULT_SORT
            const order = (context.query.order as ApiType.SortOrdersType) || DEFAULT_ORDER

            if (!lat && !lon && cookies[LOCAL_STORAGE.LOCATION]) {
                const userLocation = cookies[LOCAL_STORAGE.LOCATION]?.split(';')

                if (userLocation?.[0] && userLocation[1]) {
                    isUserLocation = true

                    lat = parseFloat(userLocation[0])
                    lon = parseFloat(userLocation[1])
                }
            }

            const translations = await serverSideTranslations(locale)

            const locationType: ApiType.LocationTypes | null =
                !country && !region && !district && !locality
                    ? null
                    : country
                      ? 'country'
                      : region
                        ? 'region'
                        : district
                          ? 'district'
                          : 'locality'

            store.dispatch(setLocale(locale))

            const locationData = !locationType
                ? null
                : await store.dispatch(
                      API.endpoints.locationGetByType.initiate({
                          id: country ?? region ?? district ?? locality,
                          type: locationType
                      })
                  )

            if (locationType && locationData?.isError) {
                return { notFound: true }
            }

            const { data: categoriesData } = await store.dispatch(API.endpoints.categoriesGetList.initiate())

            if (!!category && !categoriesData?.items?.find(({ name }) => name === category)) {
                return { notFound: true }
            }

            const { data: placesList } = await store.dispatch(
                API.endpoints.placesGetList.initiate({
                    category,
                    country,
                    district,
                    lat,
                    limit: POST_PER_PAGE,
                    locality,
                    lon,
                    offset: (currentPage - 1) * POST_PER_PAGE,
                    order: order,
                    region,
                    sort: sort,
                    tag
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    categoriesData: categoriesData?.items ?? [],
                    category,
                    country,
                    currentPage,
                    district,
                    lat: !isUserLocation ? lat : null,
                    locality,
                    locationData: locationData?.data || null,
                    locationType,
                    lon: !isUserLocation ? lon : null,
                    order,
                    placesCount: placesList?.count ?? 0,
                    placesList: placesList?.items ?? [],
                    region,
                    sort,
                    tag
                }
            }
        }
)

export default PlacesPage
