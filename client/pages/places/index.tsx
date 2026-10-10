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
import { AppLayout, EmptyState, PageHeader, PaginationBar, PlacesList } from '@/components/shared'
import { AUTH_COOKIES } from '@/config/constants'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { PlaceFilterPanel, PlacesFilterType } from '@/sections/place'
import { getCategoryTitle, isCategoryName } from '@/utils/categories'
import { buildPlacesHref, encodeQueryData, getLandingFlags } from '@/utils/helpers'
import { PlaceSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const DEFAULT_SORT = ApiType.SortFields.Trending
const DEFAULT_ORDER = ApiType.SortOrders.DESC
const POST_PER_PAGE = 21

interface PlacesPageProps {
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
    /**
     * The sort the server applies when the URL has none: `recommended` for a signed-in
     * visitor, `trending` for a guest. Equal to `sort` means "no `?sort=` in the URL".
     */
    defaultSort: ApiType.SortFieldsType
    order: ApiType.SortOrdersType
    currentPage: number
    placesCount: number
    placesList: ApiModel.Place[]
}

const PlacesPage: NextPage<PlacesPageProps> = ({
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
    defaultSort,
    order,
    currentPage,
    placesCount,
    placesList
}) => {
    const { t, i18n } = useTranslation()

    const router = useRouter()
    const flags = getLandingFlags()

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
        sort: sort !== defaultSort ? sort : undefined,
        tag: tag ?? undefined
    }

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    // 2+ categories: canonical drops `category` entirely (features/20-location-seo-pages.md)
    const canonicalQuery = encodeQueryData({
        ...initialFilter,
        category: category?.includes(',') ? undefined : initialFilter.category,
        lat: undefined,
        lon: undefined,
        order: undefined,
        sort: undefined
    })
    const canonicalPage = `${canonicalUrl}places${canonicalQuery}`

    const handleChangeFilter = useCallback(
        async (key: keyof PlacesFilterType, value: string | number | undefined) => {
            const filter = { ...initialFilter, [key]: value }

            const resetPage =
                (filter.category !== category ||
                    filter.country !== country ||
                    filter.district !== district ||
                    filter.region !== region ||
                    filter.locality !== locality) &&
                currentPage !== 1

            const filterLocationType = filter.country
                ? 'country'
                : filter.region
                  ? 'region'
                  : filter.district
                    ? 'district'
                    : filter.locality
                      ? 'locality'
                      : undefined

            // This page never fetched a slug for the current/newly picked location (it has no
            // SSR resolve call), so `buildPlacesHref` falls back to the legacy `?region=…`
            // query param here — exactly as it does for any location without a slug yet. The
            // dedicated landing page (`pages/places/landing/[...slug].tsx`) always has one.
            const target = buildPlacesHref(
                {
                    category: filter.category,
                    defaultOrder: DEFAULT_ORDER,
                    defaultSort,
                    lat: filter.lat,
                    location: filterLocationType
                        ? { id: (filter[filterLocationType] as number) ?? 0, slug: null, type: filterLocationType }
                        : null,
                    lon: filter.lon,
                    order: filter.order,
                    page: resetPage ? undefined : filter.page,
                    sort: filter.sort,
                    tag: filter.tag
                },
                flags
            )

            return await router.push(target.href)
        },
        [category, country, currentPage, defaultSort, district, flags, initialFilter, locality, region, router]
    )

    const handleClearLocationFilter = async () => {
        const target = buildPlacesHref(
            {
                category: initialFilter.category,
                defaultOrder: DEFAULT_ORDER,
                defaultSort,
                lat: initialFilter.lat,
                location: null,
                lon: initialFilter.lon,
                order: initialFilter.order,
                page: initialFilter.page,
                sort: initialFilter.sort,
                tag: initialFilter.tag
            },
            flags
        )

        return await router.push(target.href)
    }

    const handleChangeLocation = async (location?: ApiModel.AddressItem) => {
        if (!location) {
            await handleClearLocationFilter()
        } else {
            await handleChangeFilter(location.type ?? 'locality', location.id)
        }
    }

    // The label of a single selected category; several (comma list) or an unknown key get none
    const currentCategory = isCategoryName(category) ? getCategoryTitle(t, category) : undefined

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

    const description = useMemo(() => {
        const base = t('places-seo-description')
        if (!currentCategory && !locationType && !tag) {
            return base
        }
        return `${title} — ${base}`
    }, [title, currentCategory, locationType, tag, i18n.language])

    const breadcrumbsLinks = useMemo(() => {
        const breadcrumbs = []

        if (category || locationType || tag || currentPage > 1) {
            breadcrumbs.push({
                link: '/places',
                text: t('nav-places', { defaultValue: 'Места' })
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

    const isGeoFiltered = !!(lat || lon || sort !== defaultSort || order !== DEFAULT_ORDER)
    // 2+ categories (features/20-location-seo-pages.md: "2+ категории — только
    // query-параметром... noindex, follow"), independent of the landing flags: this rule is
    // about an SEO meta tag, not a URL, so it applies as soon as the API accepts the list.
    const isMultiCategory = !!category?.includes(',')

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: title,
                    description: description,
                    canonical: canonicalPage,
                    noindex: isGeoFiltered || isMultiCategory,
                    nofollow: false,
                    openGraph: {
                        description: description,
                        images: placesList
                            .filter(({ cover }) => cover?.full)
                            .slice(0, 3)
                            .map(({ cover, title }) => ({
                                alt: `${title}`,
                                url: `${IMG_HOST}${cover?.full}`
                            })),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: title,
                        type: 'website',
                        url: canonicalPage
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('places', canonicalQuery)
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
            {!isGeoFiltered && (category || tag) && (
                <JsonLdScript
                    scriptKey={'places-item-list'}
                    data={{
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        name: title,
                        url: canonicalPage,
                        itemListElement: placesList.map((place, index) => ({
                            '@type': 'ListItem',
                            position: (currentPage - 1) * POST_PER_PAGE + index + 1,
                            url: `${SITE_LINK}places/${place.id}`
                        }))
                    }}
                />
            )}

            <PageHeader
                title={title}
                breadcrumbs={breadcrumbsLinks}
                lede={
                    currentPage === 1 && !currentCategory && !locationType && !tag
                        ? t('places-seo-description')
                        : undefined
                }
            />

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

            {placesList?.length ? (
                <>
                    <PlacesList places={placesList} />
                    <PaginationBar
                        currentPage={currentPage}
                        totalItemsCount={placesCount}
                        perPage={POST_PER_PAGE}
                        urlParam={initialFilter}
                        linkPart={'places'}
                    />
                </>
            ) : (
                <Container>
                    <EmptyState />
                </Container>
            )}
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
            const defaultSort = cookies[AUTH_COOKIES.TOKEN] ? ApiType.SortFields.Recommended : DEFAULT_SORT
            const sort = (context.query.sort as ApiType.SortFieldsType) || defaultSort
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

            // An id that `locations:rebuild` merged away (location_legacy_ids) still has a
            // page: the same listing under the surviving id. With the location pages on, the
            // landing redirect below handles it; before that, the query URL is rewritten here.
            if (locationType && locationData?.isError) {
                const legacyId = country ?? region ?? district ?? locality
                const resolved = legacyId
                    ? await store.dispatch(API.endpoints.locationsResolve.initiate({ legacyId, type: locationType }))
                    : null

                if (resolved?.data && ApiType.Locations.isResolvedLocation(resolved.data)) {
                    const query = { ...context.query, [locationType]: String(resolved.data.id) }
                    context.res.statusCode = 301
                    context.res.setHeader('Location', `${locale === 'en' ? '/en' : ''}/places${encodeQueryData(query)}`)
                    context.res.end()
                    return { props: {} as PlacesPageProps }
                }

                return { notFound: true }
            }

            if (!!category && !category.includes(',') && !isCategoryName(category)) {
                return { notFound: true }
            }

            // 301 from the old query-param URLs once the relevant landing flag is on
            // (features/20-location-seo-pages.md, "Поэтапный запуск"): a bare category moves
            // to `/places/{category}` at stage 2, a location to `/places/{location}` at stage
            // 3 — a combination of both stays here until stage 4 ships (see `buildPlacesHref`).
            // A raw `res.writeHead` for a true 301, the same pattern `pages/sitemap.tsx` uses
            // for a hand-written response, since `getServerSideProps`'s own `redirect: { permanent: true }` sends a 308 in Next.js, not a 301.
            const flags = getLandingFlags()

            if ((flags.categories && category && !category.includes(',')) || (flags.locations && locationType)) {
                const legacyId = country ?? region ?? district ?? locality
                const resolvedLocation =
                    flags.locations && locationType && legacyId
                        ? await store.dispatch(
                              API.endpoints.locationsResolve.initiate({ legacyId, type: locationType })
                          )
                        : null

                const target = buildPlacesHref(
                    {
                        category,
                        defaultOrder: DEFAULT_ORDER,
                        defaultSort,
                        lat,
                        location:
                            locationType && legacyId
                                ? {
                                      id: legacyId,
                                      slug:
                                          resolvedLocation?.data && 'slug' in resolvedLocation.data
                                              ? resolvedLocation.data.slug
                                              : null,
                                      type: locationType
                                  }
                                : null,
                        lon,
                        order,
                        page: currentPage,
                        sort,
                        tag
                    },
                    flags
                )

                if (target.pathname !== '/places') {
                    context.res.statusCode = 301
                    context.res.setHeader('Location', (locale === 'en' ? '/en' : '') + target.href)
                    context.res.end()
                    return { props: {} as PlacesPageProps }
                }
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

            // A page past the end is not a page: 404 instead of an empty, indexable listing
            if (currentPage > 1 && !placesList?.items?.length) {
                return { notFound: true }
            }

            return {
                props: {
                    ...translations,
                    category,
                    country,
                    currentPage,
                    defaultSort,
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
