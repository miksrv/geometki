import React, { useCallback, useEffect, useState } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { SearchFilters, SearchPageQuery } from '@/components/pages/search/SearchFilters'
import { SearchMap } from '@/components/pages/search/SearchMap'
import { SearchResults, SearchResultsSkeleton } from '@/components/pages/search/SearchResults'
import { AppLayout, EmptyState, PageHeader } from '@/components/shared'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

import styles from './index.module.sass'

const PLACES_LIMIT = 7

interface SearchPageProps {
    initialQuery: SearchPageQuery
    initialData: ApiType.Search.Response
}

const SearchPage: NextPage<SearchPageProps> = ({ initialQuery, initialData }) => {
    const { t } = useTranslation()
    const router = useRouter()

    const userLocation = useAppSelector((state) => state.application.userLocation)

    const [query, setQuery] = useState<SearchPageQuery>(initialQuery)
    const [offset, setOffset] = useState(PLACES_LIMIT)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [extraPlaces, setExtraPlaces] = useState<ApiType.Search.Response['places']>()

    useEffect(() => {
        setQuery(initialQuery)
        setOffset(PLACES_LIMIT)
        setExtraPlaces(undefined)
    }, [router.query.q])

    // type=coordinates relies on the coordinate parser which only runs with type=all on the backend
    const apiType: ApiType.Search.Request['type'] = query.type === 'coordinates' ? 'all' : query.type

    const { data: searchData, isFetching } = API.useSearchQuery(
        {
            q: query.q,
            type: apiType,
            category: query.category || undefined,
            sort: query.sort,
            order: query.order,
            lat: userLocation?.lat ?? null,
            lon: userLocation?.lon ?? null,
            limit: PLACES_LIMIT,
            offset: 0
        },
        { skip: !query.q }
    )

    const [triggerSearch] = API.useLazySearchQuery()

    const data = searchData ?? initialData

    const mergedData: ApiType.Search.Response = {
        ...data,
        places: extraPlaces
            ? {
                  count: data.places?.count ?? 0,
                  items: [...(data.places?.items ?? []), ...(extraPlaces.items ?? [])]
              }
            : data.places
    }

    const handleChangeFilter = useCallback((key: keyof SearchPageQuery, value: string) => {
        setQuery((prev) => ({ ...prev, [key]: value }))
        setOffset(PLACES_LIMIT)
        setExtraPlaces(undefined)
    }, [])

    const handleLoadMore = useCallback(async () => {
        setIsLoadingMore(true)

        try {
            const result = await triggerSearch({
                q: query.q,
                type: apiType,
                category: query.category || undefined,
                sort: query.sort,
                order: query.order,
                lat: userLocation?.lat ?? null,
                lon: userLocation?.lon ?? null,
                limit: PLACES_LIMIT,
                offset
            })

            if (result.data?.places) {
                setExtraPlaces((prev) => ({
                    count: result.data!.places!.count,
                    items: [...(prev?.items ?? []), ...(result.data!.places!.items ?? [])]
                }))
                setOffset((prev) => prev + PLACES_LIMIT)
            }
        } finally {
            setIsLoadingMore(false)
        }
    }, [query, offset, userLocation, triggerSearch])

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

            <Container>
                <SearchFilters
                    query={query}
                    onChange={handleChangeFilter}
                />
            </Container>

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

            const q = (context.query.q as string) ?? ''
            const type = (context.query.type as ApiType.Search.Request['type']) ?? 'all'
            const category = (context.query.category as string) ?? ''
            const sort = (context.query.sort as ApiType.Search.Request['sort']) ?? 'relevance'
            const order = (context.query.order as ApiType.Search.Request['order']) ?? 'desc'

            if (!q.trim()) {
                return { redirect: { destination: '/', permanent: false } }
            }

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const translations = await serverSideTranslations(locale)

            const { data: initialData } = await store.dispatch(
                API.endpoints.search.initiate({
                    q,
                    type,
                    category: category || undefined,
                    sort,
                    order,
                    limit: PLACES_LIMIT,
                    offset: 0
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    initialData: initialData ?? {},
                    initialQuery: { q, type, category, sort, order }
                }
            }
        }
)

export default SearchPage
