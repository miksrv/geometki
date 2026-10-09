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
import { AppLayout, EmptyState, LocationLinkList, PageHeader, PlacesList } from '@/components/shared'
import type { LocationLinkListItem } from '@/components/shared/location-link-list'
import { Pagination } from '@/components/ui'
import { AUTH_COOKIES } from '@/config/constants'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { PlaceFilterPanel, PlacesFilterType, PlacesLandingIntro } from '@/sections/place'
import { buildPlacesHref, encodeQueryData, formatDate, getLandingFlags, LANDING_PROXY_HEADER } from '@/utils/helpers'
import type { LandingFlags } from '@/utils/placesLanding'
import type { LandingClassification, ResolvedSegment } from '@/utils/placesLandingResolve'
// Two lint rules disagree on importing both a value and a type from the same module — see the
// identical note in `proxy.ts`.
// eslint-disable-next-line no-duplicate-imports
import {
    buildLandingCanonicalPath,
    classifyLandingSegments,
    computeLandingNoindex,
    decideLandingRedirect,
    isLandingEmpty,
    isLandingPageOutOfRange
} from '@/utils/placesLandingResolve'
import { PlaceSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const DEFAULT_SORT = ApiType.SortFields.Trending
const DEFAULT_ORDER = ApiType.SortOrders.DESC
const POST_PER_PAGE = 21

type PageKind = 'category' | 'location' | 'pair'

interface LocationSummary {
    placesCount: number
    categories: Array<{ title: string; count: number }>
    lastAddedAt: string | null
}

interface PlacesLandingPageProps {
    kind: PageKind
    pathname: string
    locationType: ApiType.LocationTypes | null
    locationId: number | null
    locationSlug: string | null
    locationTitle: string | null
    locationParents: ApiType.Locations.LocationParentRef[]
    categoryName: string | null
    categoryTitle: string | null
    /** Category-only page: `category.content` from the DB, already localized. `null` elsewhere. */
    categoryContent: string | null
    /** Location-only page: the data behind the summary description. `null` elsewhere. */
    summary: LocationSummary | null
    /** Pair page: place count of this category within this location. `null` elsewhere. */
    pairCount: number | null
    indexable: boolean
    chips: LocationLinkListItem[]
    children: LocationLinkListItem[]
    relatedLocations: LocationLinkListItem[]
    tag: string | null
    queryCategories: string[]
    sort: ApiType.SortFieldsType
    order: ApiType.SortOrdersType
    lat: number | null
    lon: number | null
    currentPage: number
    placesCount: number
    placesList: ApiModel.Place[]
}

const PlacesLandingPage: NextPage<PlacesLandingPageProps> = ({
    kind,
    pathname,
    locationType,
    locationId,
    locationSlug,
    locationTitle,
    locationParents,
    categoryName,
    categoryTitle,
    categoryContent,
    summary,
    pairCount,
    indexable,
    chips,
    children,
    relatedLocations,
    tag,
    queryCategories,
    sort,
    order,
    lat,
    lon,
    currentPage,
    placesCount,
    placesList
}) => {
    const { t, i18n } = useTranslation()
    const router = useRouter()

    const flags = getLandingFlags()

    const locationRef = useMemo(
        () => (locationType && locationId ? { id: locationId, slug: locationSlug, type: locationType } : undefined),
        [locationType, locationId, locationSlug]
    )

    const currentFilterCategory = categoryName ?? (queryCategories.length ? queryCategories.join(',') : undefined)

    const handleChangeFilter = useCallback(
        async (key: keyof PlacesFilterType, value: string | number | undefined) => {
            const nextLocation =
                key === 'country' || key === 'region' || key === 'district' || key === 'locality'
                    ? value
                        ? { id: Number(value), slug: null, type: key as ApiType.LocationTypes }
                        : undefined
                    : locationRef

            const nextCategory = key === 'category' ? (value as string | undefined) : currentFilterCategory

            const target = buildPlacesHref(
                {
                    category: nextCategory,
                    defaultOrder: DEFAULT_ORDER,
                    defaultSort: DEFAULT_SORT,
                    lat,
                    location: nextLocation,
                    lon,
                    order: key === 'order' ? (value as ApiType.SortOrdersType) : order,
                    page: key === 'category' || key === 'country' || key === 'region' ? undefined : currentPage,
                    sort: key === 'sort' ? (value as ApiType.SortFieldsType) : sort,
                    tag: key === 'tag' ? (value as string | undefined) : tag
                },
                flags
            )

            return await router.push(target.href)
        },
        [currentFilterCategory, currentPage, flags, lat, locationRef, lon, order, router, sort, tag]
    )

    const handleChangeLocation = async (location?: ApiModel.AddressItem) => {
        const target = buildPlacesHref(
            {
                category: currentFilterCategory,
                defaultOrder: DEFAULT_ORDER,
                defaultSort: DEFAULT_SORT,
                lat,
                location: location ? { id: location.id, slug: location.slug, type: location.type ?? 'locality' } : null,
                lon,
                order,
                sort,
                tag
            },
            flags
        )

        return await router.push(target.href)
    }

    const h1 =
        kind === 'category'
            ? (categoryTitle ?? '')
            : kind === 'pair'
              ? t('landing-title-pair', '{{category}} — {{location}}', {
                    category: categoryTitle,
                    location: locationTitle
                })
              : t('landing-title-location', 'Интересные места: {{location}}', { location: locationTitle })

    const titlePageSuffix = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = h1 + titlePageSuffix

    // The listing's intro text (features/20-location-seo-pages.md, "Шаблон страницы →
    // Описание"): the category's own text, or a summary built from the location/pair's data.
    const description = useMemo(() => {
        if (kind === 'category') {
            return categoryContent ?? ''
        }

        if (kind === 'pair') {
            return t('landing-description-pair', '{{count}} places in {{location}}', {
                count: pairCount ?? 0,
                location: locationTitle
            })
        }

        if (kind === 'location' && summary) {
            const parts = [t('landing-description-places', '{{count}} places', { count: summary.placesCount })]

            if (summary.categories.length) {
                const list = summary.categories.map((c) => `${c.title} (${c.count})`).join(', ')
                parts.push(t('landing-description-top-categories', 'Top categories: {{list}}', { list }))
            }

            if (summary.lastAddedAt) {
                parts.push(
                    t('landing-description-last-added', 'Last added: {{date}}', {
                        date: formatDate(summary.lastAddedAt)
                    })
                )
            }

            return parts.join('. ')
        }

        return ''
    }, [kind, categoryContent, pairCount, locationTitle, summary, t])

    const chipsTitle =
        kind === 'pair'
            ? t('landing-chips-title-pair', 'Other categories here')
            : kind === 'location'
              ? t('categories')
              : ''

    const relatedTitle =
        kind === 'category'
            ? t('landing-related-by-region', '{{category}} by region', { category: categoryTitle })
            : kind === 'pair'
              ? t('landing-related-nearby', '{{category}} nearby', { category: categoryTitle })
              : ''

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const canonicalQuery = encodeQueryData({
        lat: undefined,
        order: undefined,
        page: currentPage !== 1 ? currentPage : undefined,
        sort: undefined,
        tag: tag ?? undefined
    })
    const canonicalPage = `${canonicalUrl}${pathname.replace(/^\//, '')}${canonicalQuery}`

    const breadcrumbsLinks = useMemo(() => {
        const links: Array<{ link: string; text: string }> = [{ link: '/places', text: t('nav-places', 'Места') }]

        locationParents.forEach((parent) => {
            if (parent.slug) {
                links.push({ link: `/places/${parent.slug}`, text: parent.title })
            }
        })

        if (kind === 'pair' && locationSlug && locationTitle) {
            links.push({ link: `/places/${locationSlug}`, text: locationTitle })
        }

        return links
    }, [kind, locationParents, locationSlug, locationTitle, t])

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
            ...breadcrumbsLinks.map((link, i) => ({
                '@type': 'ListItem',
                item: `${canonicalUrl}${link.link.replace(/^\//, '')}`,
                name: link.text,
                position: i + 2
            })),
            {
                '@type': 'ListItem',
                item: canonicalPage,
                name: h1,
                position: breadcrumbsLinks.length + 2
            }
        ]
    }

    const isGeoFiltered = !!(lat || lon || sort !== DEFAULT_SORT || order !== DEFAULT_ORDER)
    const multiCategory = queryCategories.length >= 2
    const noindex = computeLandingNoindex({ indexable, isGeoFiltered, multiCategory })

    const mapQuery = categoryName ? `?category=${categoryName}` : ''

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    additionalLinkTags: buildHreflangTags(pathname.replace(/^\//, '')),
                    canonical: canonicalPage,
                    description,
                    nofollow: false,
                    noindex,
                    openGraph: {
                        description,
                        images: placesList
                            .filter(({ cover }) => cover?.full)
                            .slice(0, 3)
                            .map(({ cover, title }) => ({ alt: `${title}`, url: `${IMG_HOST}${cover?.full}` })),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: canonicalPage
                    },
                    title,
                    twitter: { cardType: 'summary_large_image' }
                })}
            </Head>

            <JsonLdScript
                scriptKey={'places-landing-breadcrumb'}
                data={breadCrumbSchema}
            />
            <JsonLdScript
                scriptKey={'places-landing-list'}
                data={placesList.map((place) => PlaceSchema(place, SITE_LINK))}
            />
            {!isGeoFiltered && currentPage === 1 && (
                <JsonLdScript
                    scriptKey={'places-landing-item-list'}
                    data={{
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        itemListElement: placesList.map((place, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            url: `${SITE_LINK}places/${place.id}`
                        })),
                        name: title,
                        url: canonicalPage
                    }}
                />
            )}

            <PageHeader
                title={h1}
                breadcrumbs={breadcrumbsLinks}
            />

            {currentPage === 1 && (
                <PlacesLandingIntro
                    description={description}
                    showMap={kind !== 'category'}
                    places={placesList}
                    fullMapQuery={mapQuery}
                />
            )}

            <Container style={{ padding: '10px' }}>
                <PlaceFilterPanel
                    sort={sort}
                    order={order}
                    category={categoryName ?? (queryCategories[0] as string | undefined)}
                    location={
                        locationRef
                            ? { id: locationRef.id, name: locationTitle ?? '', type: locationRef.type }
                            : undefined
                    }
                    onChange={handleChangeFilter}
                    onChangeLocation={handleChangeLocation}
                />
            </Container>

            {placesList?.length ? (
                <>
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
                            urlParam={{ lat, lon, order, sort, tag }}
                            linkPart={pathname.replace(/^\//, '')}
                        />
                    </Container>
                </>
            ) : (
                <Container>
                    <EmptyState />
                </Container>
            )}

            {currentPage === 1 && (
                <>
                    <LocationLinkList
                        title={chipsTitle}
                        items={chips}
                    />
                    <LocationLinkList
                        title={t('landing-children-title', 'Районы и города')}
                        items={children}
                    />
                    <LocationLinkList
                        title={relatedTitle}
                        items={relatedLocations}
                    />
                </>
            )}
        </AppLayout>
    )
}

const writeRedirect = (
    context: { res: { statusCode: number; setHeader: (n: string, v: string) => void; end: () => void } },
    locale: string,
    path: string
) => {
    context.res.statusCode = 301
    context.res.setHeader('Location', (locale === 'en' ? '/en' : '') + path)
    context.res.end()
}

/** Only items with a slug can be linked (features/20-location-seo-pages.md: "slug" is `null` until assigned) — same rule `pages/sitemap.tsx` applies to the sitemap entries */
const hasSlug = <T extends { slug?: string | null }>(item: T): item is T & { slug: string } => !!item.slug

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlacesLandingPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'ru') as ApiType.Locale
            const flags: LandingFlags = getLandingFlags()

            const rawSlug = context.params?.slug
            const segments = Array.isArray(rawSlug) ? rawSlug : rawSlug ? [rawSlug] : []

            if (segments.length < 1 || segments.length > 2) {
                return { notFound: true }
            }

            hydrateAuthFromCookies(store, cookies)
            const translations = await serverSideTranslations(locale)
            store.dispatch(setLocale(locale))

            const currentPage = parseInt(context.query.page as string, 10) || 1
            const lat = parseFloat(context.query.lat as string) || null
            const lon = parseFloat(context.query.lon as string) || null
            const tag = (context.query.tag as string) || null
            const sort =
                (context.query.sort as ApiType.SortFieldsType) ||
                (cookies[AUTH_COOKIES.TOKEN] ? ApiType.SortFields.Recommended : DEFAULT_SORT)
            const order = (context.query.order as ApiType.SortOrdersType) || DEFAULT_ORDER
            const rawQueryCategory = (context.query.category as string) || ''
            const queryCategoriesFromUrl = rawQueryCategory
                ? Array.from(
                      new Set(
                          rawQueryCategory
                              .split(',')
                              .map((c) => c.trim())
                              .filter(Boolean)
                      )
                  )
                : []

            const [first, second] = segments
            const query = { ...context.query }
            delete query.slug

            const resolveSegment = (slug: string) => store.dispatch(API.endpoints.locationsResolve.initiate({ slug }))

            // Resolves one path segment to the minimal shape `classifyLandingSegments` needs
            // (`segment`) plus whichever full entity it turned out to be, chasing one redirect
            // hop for a superseded location slug — a category has no history, see
            // `App\Controllers\Locations::resolveSlug`.
            const resolveFull = async (
                slug: string
            ): Promise<{
                segment: ResolvedSegment
                location?: ApiType.Locations.ResolvedLocation
                category?: ApiType.Locations.ResolvedCategory
            } | null> => {
                const res = await resolveSegment(slug)
                if (res.isError || !res.data) {
                    return null
                }

                let data = res.data

                if (ApiType.Locations.isResolvedRedirect(data)) {
                    const chased = await resolveSegment(data.redirect)
                    if (chased.isError || !chased.data) {
                        return null
                    }
                    data = chased.data
                }

                if (ApiType.Locations.isResolvedCategory(data)) {
                    return { category: data, segment: { kind: 'category', name: data.name } }
                }

                if (ApiType.Locations.isResolvedLocation(data)) {
                    return { location: data, segment: { kind: 'location', slug: data.slug } }
                }

                return null
            }

            const fullA = await resolveFull(first)
            const fullB = second ? await resolveFull(second) : null

            const classification: LandingClassification = classifyLandingSegments(
                fullA?.segment ?? null,
                fullB?.segment ?? null
            )

            if (
                classification.kind === 'not-found' ||
                (classification.kind === 'category' && !flags.categories) ||
                (classification.kind === 'location' && !flags.locations) ||
                (classification.kind === 'pair' && !flags.combinations)
            ) {
                return { notFound: true }
            }

            // A direct hit on this internal path (bypassing the proxy rewrite that is the only
            // legitimate way here), a superseded slug, or a reversed pair all 301 to the one
            // canonical URL — see `decideLandingRedirect`'s doc comment (review finding,
            // 2026-10-09: `/places/landing/...` was otherwise reachable and indexable as a
            // duplicate of `/places/{...}`).
            const isProxied = !!context.req.headers[LANDING_PROXY_HEADER]
            const redirectPath = decideLandingRedirect({ classification, isProxied, requestedSegments: segments })

            if (redirectPath) {
                writeRedirect(context, locale, `${redirectPath}${encodeQueryData(query)}`)
                return { props: {} as PlacesLandingPageProps }
            }

            const canonicalPathname = buildLandingCanonicalPath(classification) ?? '/places'
            const locationData = fullA?.location ?? fullB?.location
            const categoryData = fullA?.category ?? fullB?.category

            if (classification.kind === 'category') {
                const { data: categoriesWithPlaces } = await store.dispatch(
                    API.endpoints.categoriesGetList.initiate({ places: true })
                )
                const category = categoriesWithPlaces?.items?.find((c) => c.name === categoryData!.name)

                if (!category || isLandingEmpty(category.count ?? 0)) {
                    return { notFound: true }
                }

                const { data: relatedData } = await store.dispatch(
                    API.endpoints.categoriesGetLocations.initiate({ level: 'region', name: categoryData!.name })
                )

                const { data: placesList } = await store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        category: queryCategoriesFromUrl.length ? queryCategoriesFromUrl.join(',') : categoryData!.name,
                        lat,
                        limit: POST_PER_PAGE,
                        offset: (currentPage - 1) * POST_PER_PAGE,
                        order,
                        sort,
                        tag
                    })
                )

                await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

                if (isLandingPageOutOfRange(currentPage, placesList?.items?.length ?? 0)) {
                    return { notFound: true }
                }

                return {
                    props: {
                        ...translations,
                        categoryContent: category.content ?? null,
                        categoryName: categoryData!.name,
                        categoryTitle: categoryData!.title,
                        chips: [],
                        children: [],
                        currentPage,
                        indexable: true,
                        kind: 'category',
                        lat,
                        locationId: null,
                        locationParents: [],
                        locationSlug: null,
                        locationTitle: null,
                        locationType: null,
                        lon,
                        order,
                        pairCount: null,
                        pathname: canonicalPathname,
                        placesCount: placesList?.count ?? 0,
                        placesList: placesList?.items ?? [],
                        queryCategories: queryCategoriesFromUrl,
                        relatedLocations: (relatedData?.items ?? []).filter(hasSlug).map((item) => ({
                            count: item.placesCount,
                            href: `/places/${item.slug}/${categoryData!.name}`,
                            key: `${item.type}-${item.id}`,
                            title: item.title
                        })),
                        sort,
                        summary: null,
                        tag
                    }
                }
            }

            if (classification.kind === 'location') {
                if (isLandingEmpty(locationData!.placesCount)) {
                    return { notFound: true }
                }

                const { data: chipsData } = await store.dispatch(
                    API.endpoints.locationsGetCategories.initiate({ id: locationData!.id, type: locationData!.type })
                )
                const { data: childrenData } = await store.dispatch(
                    API.endpoints.locationsGetChildren.initiate({ id: locationData!.id, type: locationData!.type })
                )
                const { data: summaryData } = await store.dispatch(
                    API.endpoints.locationsGetSummary.initiate({ id: locationData!.id, type: locationData!.type })
                )
                const { data: placesList } = await store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        category: queryCategoriesFromUrl.length ? queryCategoriesFromUrl.join(',') : undefined,
                        lat,
                        limit: POST_PER_PAGE,
                        location: locationData!.slug ?? undefined,
                        lon,
                        offset: (currentPage - 1) * POST_PER_PAGE,
                        order,
                        sort,
                        tag
                    })
                )

                await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

                if (isLandingPageOutOfRange(currentPage, placesList?.items?.length ?? 0)) {
                    return { notFound: true }
                }

                return {
                    props: {
                        ...translations,
                        categoryContent: null,
                        categoryName: null,
                        categoryTitle: null,
                        chips: (chipsData?.items ?? []).map((item) => ({
                            count: item.count,
                            href: `/places/${locationData!.slug}/${item.name}`,
                            key: item.name,
                            title: item.title
                        })),
                        children: (childrenData?.items ?? []).filter(hasSlug).map((item) => ({
                            count: item.placesCount,
                            href: `/places/${item.slug}`,
                            key: `${item.type}-${item.id}`,
                            title: item.title
                        })),
                        currentPage,
                        indexable: locationData!.indexable,
                        kind: 'location',
                        lat,
                        locationId: locationData!.id,
                        locationParents: locationData!.parents,
                        locationSlug: locationData!.slug,
                        locationTitle: locationData!.title,
                        locationType: locationData!.type,
                        lon,
                        order,
                        pairCount: null,
                        pathname: canonicalPathname,
                        placesCount: placesList?.count ?? 0,
                        placesList: placesList?.items ?? [],
                        queryCategories: queryCategoriesFromUrl,
                        relatedLocations: [],
                        sort,
                        summary: summaryData
                            ? {
                                  categories: summaryData.categories.map((c) => ({ count: c.count, title: c.title })),
                                  lastAddedAt: summaryData.lastAddedAt,
                                  placesCount: summaryData.placesCount
                              }
                            : null,
                        tag
                    }
                }
            }

            // classification.kind === 'pair'
            const { data: chipsData } = await store.dispatch(
                API.endpoints.locationsGetCategories.initiate({ id: locationData!.id, type: locationData!.type })
            )
            const currentCategoryItem = chipsData?.items?.find((item) => item.name === categoryData!.name)

            if (!currentCategoryItem || isLandingEmpty(currentCategoryItem.count)) {
                return { notFound: true }
            }

            const { data: nearbyData } = await store.dispatch(
                API.endpoints.categoriesGetLocations.initiate({
                    level:
                        locationData!.type === 'locality' || locationData!.type === 'district' ? 'locality' : 'region',
                    name: categoryData!.name
                })
            )

            const { data: placesList } = await store.dispatch(
                API.endpoints.placesGetList.initiate({
                    category: categoryData!.name,
                    lat,
                    limit: POST_PER_PAGE,
                    location: locationData!.slug ?? undefined,
                    lon,
                    offset: (currentPage - 1) * POST_PER_PAGE,
                    order,
                    sort,
                    tag
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            if (isLandingPageOutOfRange(currentPage, placesList?.items?.length ?? 0)) {
                return { notFound: true }
            }

            return {
                props: {
                    ...translations,
                    categoryContent: null,
                    categoryName: categoryData!.name,
                    categoryTitle: categoryData!.title,
                    chips: (chipsData?.items ?? [])
                        .filter((item) => item.name !== categoryData!.name)
                        .map((item) => ({
                            count: item.count,
                            href: `/places/${locationData!.slug}/${item.name}`,
                            key: item.name,
                            title: item.title
                        })),
                    children: [],
                    currentPage,
                    indexable: currentCategoryItem.indexable,
                    kind: 'pair',
                    lat,
                    locationId: locationData!.id,
                    locationParents: locationData!.parents,
                    locationSlug: locationData!.slug,
                    locationTitle: locationData!.title,
                    locationType: locationData!.type,
                    lon,
                    order,
                    pairCount: currentCategoryItem.count,
                    pathname: canonicalPathname,
                    placesCount: placesList?.count ?? 0,
                    placesList: placesList?.items ?? [],
                    queryCategories: [],
                    relatedLocations: (nearbyData?.items ?? [])
                        .filter((item) => !(item.type === locationData!.type && item.id === locationData!.id))
                        .filter(hasSlug)
                        .map((item) => ({
                            count: item.placesCount,
                            href: `/places/${item.slug}/${categoryData!.name}`,
                            key: `${item.type}-${item.id}`,
                            title: item.title
                        })),
                    sort,
                    summary: null,
                    tag
                }
            }
        }
)

export default PlacesLandingPage
