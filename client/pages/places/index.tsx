import React, { useCallback, useMemo } from 'react'
import { Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header, PlacesList } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { AUTH_COOKIES } from '@/config/constants'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { PlaceFilterPanel, PlacesFilterType } from '@/sections/place'
import { encodeQueryData } from '@/utils/helpers'
import { PlaceSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const DEFAULT_SORT = ApiType.SortFields.Trending
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

    const breadCrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                item: canonicalUrl,
                name: t('geotags'),
                position: 1
            },
            ...(breadcrumbsLinks?.map((link, i) => ({
                '@type': 'ListItem',
                item: `${canonicalUrl}${link.link.replace(/^\//, '')}`,
                name: link.text,
                position: i + 2
            })) || []),
            {
                '@type': 'ListItem',
                item: canonicalPage,
                name: breadCrumbCurrent,
                position: breadcrumbsLinks.length + 2
            }
        ]
    }

    const isGeoFiltered = !!(lat && lon)

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: title,
                    description: title,
                    canonical: canonicalPage,
                    noindex: isGeoFiltered,
                    nofollow: false,
                    openGraph: {
                        images: placesList
                            .filter(({ cover }) => cover?.full)
                            .slice(0, 3)
                            .map(({ cover, title }) => ({
                                alt: `${title}`,
                                url: `${IMG_HOST}${cover?.full}`
                            })),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        type: 'website'
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('places')
                })}
            </Head>

            <JsonLdScript
                scriptKey={'places-breadcrumb'}
                data={breadCrumbSchema}
            />
            <JsonLdScript
                scriptKey={'places-list'}
                data={placesList.map((place) => PlaceSchema(place, SITE_LINK))}
            />

            <Header
                title={title}
                homePageTitle={t('geotags')}
                links={breadcrumbsLinks || []}
                currentPage={breadCrumbCurrent}
            />

            <Container style={{ padding: '10px' }}>
                <PlaceFilterPanel
                    sort={sort}
                    order={order}
                    category={category}
                    location={
                        locationData && locationType
                            ? { id: locationData.id, name: locationData.name, type: locationType }
                            : undefined
                    }
                    onChange={handleChangeFilter}
                    onChangeLocation={handleChangeLocation}
                />
            </Container>

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

            const lat = parseFloat(context.query.lat as string) || null
            const lon = parseFloat(context.query.lon as string) || null

            const tag = (context.query.tag as string) || null
            const sort =
                (context.query.sort as ApiType.SortFieldsType) ||
                (cookies[AUTH_COOKIES.TOKEN] ? ApiType.SortFields.Recommended : DEFAULT_SORT)
            const order = (context.query.order as ApiType.SortOrdersType) || DEFAULT_ORDER

            hydrateAuthFromCookies(store, cookies)

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
                    lat,
                    locality,
                    locationData: locationData?.data || null,
                    locationType,
                    lon,
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
