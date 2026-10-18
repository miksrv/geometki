import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { SearchMap } from '@/components/pages/search/SearchMap'
import { SearchResults, SearchResultsSkeleton } from '@/components/pages/search/SearchResults'
import { AppLayout, EmptyState, PageHeader } from '@/components/shared'
import { parseSearchQuery, SearchFilterPanel, SearchQuery } from '@/sections/search'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'
import { getUserLocationFromCookies } from '@/utils/userLocation'

import styles from './index.module.sass'

const PLACES_LIMIT = 7

interface SearchPageProps {
    initialData: ApiType.Search.Response
}

/** The API request of a search: always all kinds of results, so the tabs have their numbers */
const toRequest = (query: SearchQuery, location?: ApiType.Coordinates | null): ApiType.Search.Request => ({
    category: query.categories.length ? query.categories.join(',') : undefined,
    lat: location?.lat ?? null,
    limit: PLACES_LIMIT,
    lon: location?.lon ?? null,
    offset: 0,
    q: query.q,
    sort: query.sort,
    type: 'all'
})

const SearchPage: NextPage<SearchPageProps> = ({ initialData }) => {
    const { t } = useTranslation()
    const router = useRouter()

    const userLocation = useAppSelector((state) => state.application.userLocation)

    // The URL is the only state of the filters
    const query = useMemo(() => parseSearchQuery(router.query), [router.query])

    const [offset, setOffset] = useState(PLACES_LIMIT)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [extraPlaces, setExtraPlaces] = useState<ApiType.Search.Response['places']>()

    // The URL of the shown results: a "Показать ещё" answer for an older URL is dropped
    const currentPath = useRef(router.asPath)

    useEffect(() => {
        currentPath.current = router.asPath
        setOffset(PLACES_LIMIT)
        setExtraPlaces(undefined)
    }, [router.asPath])

    const { data: searchData, isFetching } = API.useSearchQuery(toRequest(query, userLocation), { skip: !query.q })

    const [triggerSearch] = API.useLazySearchQuery()

    const data = searchData ?? initialData

    const mergedData: ApiType.Search.Response = {
        ...data,
        places: extraPlaces
            ? {
                  ...data.places,
                  count: data.places?.count ?? 0,
                  items: [...(data.places?.items ?? []), ...(extraPlaces.items ?? [])]
              }
            : data.places
    }

    const handleLoadMore = useCallback(async () => {
        setIsLoadingMore(true)
        const requestPath = router.asPath

        try {
            const result = await triggerSearch({ ...toRequest(query, userLocation), offset })

            if (result.data?.places && requestPath === currentPath.current) {
                setExtraPlaces((prev) => ({
                    count: result.data!.places!.count,
                    items: [...(prev?.items ?? []), ...(result.data!.places!.items ?? [])]
                }))
                setOffset((prev) => prev + PLACES_LIMIT)
            }
        } finally {
            setIsLoadingMore(false)
        }
    }, [query, offset, userLocation, triggerSearch, router.asPath])

    const pageTitle = t('search-page-title', { query: query.q, defaultValue: `Поиск: ${query.q}` })
    const pageDescription = t('search-page-description', {
        query: query.q,
        defaultValue: `Результаты поиска «${query.q}» на Geometki — места, адреса и координаты`
    })
    const hasResults = (() => {
        const { locations, coordinates, places } = mergedData
        if (query.type === 'location') {
            return (locations?.count ?? 0) > 0
        }
        if (query.type === 'coordinates') {
            return coordinates != null
        }
        if (query.type === 'places') {
            return (places?.count ?? 0) > 0
        }
        return (locations?.count ?? 0) > 0 || coordinates != null || (places?.count ?? 0) > 0
    })()

    const isEmpty = !hasResults && !isFetching

    return (
        <AppLayout fitViewport={true}>
            <Head>
                {generateNextSeo({
                    title: pageTitle,
                    description: pageDescription,
                    noindex: true,
                    nofollow: true
                })}
            </Head>

            <PageHeader title={pageTitle} />

            <SearchFilterPanel
                query={query}
                data={mergedData}
            />

            {/* Desktop: the container fills the rest of the viewport and the results scroll in
                their own column next to the map; phones: a regular scrolling page with the map
                under the results */}
            <Container className={cn(styles.resultsContainer, isEmpty && styles.empty)}>
                {isEmpty ? (
                    <EmptyState />
                ) : (
                    <div className={styles.layout}>
                        <div className={styles.resultsCol}>
                            {isFetching ? (
                                <SearchResultsSkeleton type={query.type} />
                            ) : (
                                <SearchResults
                                    data={mergedData}
                                    type={query.type}
                                    userLat={userLocation?.lat}
                                    userLon={userLocation?.lon}
                                    onLoadMore={() => void handleLoadMore()}
                                    isLoadingMore={isLoadingMore}
                                />
                            )}
                        </div>

                        <div className={styles.mapCol}>
                            <SearchMap
                                places={isFetching ? undefined : mergedData.places?.items}
                                locations={isFetching ? undefined : mergedData.locations?.items}
                                coordinates={isFetching ? undefined : mergedData.coordinates}
                            />
                        </div>
                    </div>
                )}
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<SearchPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale

            const query = parseSearchQuery(context.query)

            if (!query.q) {
                return { redirect: { destination: '/', permanent: false } }
            }

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const translations = await loadPageTranslations()

            const { data: initialData } = await store.dispatch(
                API.endpoints.search.initiate(toRequest(query, getUserLocationFromCookies(cookies)))
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    initialData: initialData ?? {}
                }
            }
        }
)

export default SearchPage
