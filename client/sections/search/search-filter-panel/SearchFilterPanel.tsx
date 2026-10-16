import React, { useEffect, useState } from 'react'

import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import {
    AppliedFilterList,
    CategoryRail,
    FilterPanel,
    FilterPhoneBar,
    FilterPopout,
    FiltersButton,
    FiltersSheet,
    FilterToolbar,
    FilterToolbarSpacer
} from '@/components/shared/filter-panel'
import type { AppliedFilter } from '@/components/shared/filter-panel/AppliedFilterList'
import { OptionList, Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'
import { categoryImage, getCategoryShortTitle } from '@/utils/categories'

import {
    buildSearchHref,
    countFacets,
    DEFAULT_SEARCH_SORT,
    getSearchSortPresets,
    SearchQuery,
    SearchQueryPatch,
    SearchResultType
} from './searchQuery'

import styles from './styles.module.sass'

interface SearchFilterPanelProps {
    query: SearchQuery
    /** The first page of the results: the numbers of the tabs and the facets */
    data: ApiType.Search.Response
}

/**
 * The controls of the search (DESIGN.md → Patterns → Search filters), the places filter panel's
 * pieces: the results as `Tabs` with their numbers ("Все · Места 227 · Адреса 5"), the sort of
 * the places on the right, the categories found as a rail with their numbers, the applied
 * filters. Phones: the tabs with the round filters button, the rail, the filters sheet. Every
 * change is a shallow link or push of the URL.
 */
export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({ query, data }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const { request: requestUserLocation } = useUserLocation()

    const [sheetOpen, setSheetOpen] = useState(false)
    const [draft, setDraft] = useState({ categories: query.categories, sort: query.sort })

    useEffect(() => {
        if (sheetOpen) {
            setDraft({ categories: query.categories, sort: query.sort })
        }
    }, [sheetOpen])

    const href = (patch: SearchQueryPatch) => buildSearchHref(query, patch)

    // A change of the filters keeps the page: the URL changes, the results are fetched on the client
    // at once (no wait for `getServerSideProps`) and the page keeps its scroll
    const pushFilters = (url: string) => void router.push(url, undefined, { scroll: false, shallow: true })

    const facets = data.places?.categories as Record<string, number> | undefined
    const placesFound = countFacets(facets, [])
    const locationsCount = data.locations?.count ?? 0
    const parsedCoordinates = !!data.coordinates?.parsed

    const tabs = (
        [
            { count: undefined, key: 'all', label: t('search-filter-type-all', 'Все'), shown: true },
            {
                count: data.places?.count ?? 0,
                key: 'places',
                label: t('search-tab-places', 'Места'),
                shown: placesFound > 0
            },
            {
                count: locationsCount,
                key: 'location',
                label: t('search-filter-type-location', 'Адреса'),
                shown: locationsCount > 0
            },
            {
                count: undefined,
                key: 'coordinates',
                label: t('search-filter-type-coordinates', 'Координаты'),
                shown: parsedCoordinates
            }
        ] as Array<{ key: SearchResultType; label: string; count?: number; shown: boolean }>
    )
        .filter(({ key, shown }) => shown || key === query.type)
        .map(({ key, label, count }) => ({
            href: href({ type: key }),
            key,
            label: count !== undefined ? `${label} ${count}` : label
        }))

    const typeTabs = (
        <Tabs<SearchResultType>
            className={styles.tabs}
            aria-label={t('search-results', 'Результаты')}
            activeTab={query.type}
            tabs={tabs}
            shallow={true}
        />
    )

    // The places filters only where places are shown and found
    const placeFilters = (query.type === 'all' || query.type === 'places') && placesFound > 0

    const presets = getSearchSortPresets(t)
    const sortLabel = presets.find(({ key }) => key === query.sort)?.label ?? ''

    // Sorting by distance is what asks the browser for the location; without it the sort stays
    const allowSort = async (sort: ApiType.Search.SortType) => sort !== 'distance' || (await requestUserLocation())

    const handleSort = async (sort: ApiType.Search.SortType) => {
        if (await allowSort(sort)) {
            pushFilters(href({ sort }))
        }
    }

    const applied: AppliedFilter[] = query.categories.map((name) => ({
        href: href({ categories: query.categories.filter((item) => item !== name) }),
        icon: (
            <Image
                src={categoryImage(name as ApiModel.Categories).src}
                alt={''}
                width={16}
                height={16}
                unoptimized={true}
            />
        ),
        key: `category-${name}`,
        label: getCategoryShortTitle(t, name)
    }))

    if (query.sort !== DEFAULT_SEARCH_SORT) {
        applied.push({ href: href({ sort: DEFAULT_SEARCH_SORT }), key: 'sort', label: sortLabel })
    }

    const badge = query.categories.length + (query.sort !== DEFAULT_SEARCH_SORT ? 1 : 0)

    return (
        <>
            <FilterPanel
                sticky={'phones'}
                className={styles.panel}
            >
                <FilterToolbar>
                    {typeTabs}

                    <FilterToolbarSpacer />

                    {placeFilters && (
                        <FilterPopout
                            width={240}
                            icon={'BarChart'}
                            value={sortLabel}
                        >
                            {(close) => (
                                <OptionList
                                    groups={[
                                        {
                                            items: presets.map((preset) => ({
                                                ...preset,
                                                selected: preset.key === query.sort
                                            }))
                                        }
                                    ]}
                                    onSelect={(sort) => {
                                        close()
                                        void handleSort(sort)
                                    }}
                                />
                            )}
                        </FilterPopout>
                    )}
                </FilterToolbar>

                <FilterPhoneBar>
                    {typeTabs}

                    {placeFilters && (
                        <FiltersButton
                            count={badge}
                            onClick={() => setSheetOpen(true)}
                        />
                    )}
                </FilterPhoneBar>

                {placeFilters && (
                    <CategoryRail
                        selected={query.categories}
                        counts={facets}
                        total={placesFound}
                        hrefFor={(categories) => href({ categories })}
                        shallow={true}
                    />
                )}

                {placeFilters && (
                    <AppliedFilterList
                        filters={applied}
                        resetHref={href({ categories: [], sort: DEFAULT_SEARCH_SORT })}
                        shallow={true}
                    />
                )}
            </FilterPanel>

            {placeFilters && (
                <FiltersSheet<ApiType.Search.SortType>
                    open={sheetOpen}
                    sorts={presets}
                    sort={draft.sort}
                    categories={draft.categories}
                    counts={facets}
                    total={countFacets(facets, draft.categories)}
                    onSort={async (sort) => {
                        if (await allowSort(sort)) {
                            setDraft((prev) => ({ ...prev, sort }))
                        }
                    }}
                    onToggleCategory={(name) =>
                        setDraft((prev) => ({
                            ...prev,
                            categories: prev.categories.includes(name)
                                ? prev.categories.filter((item) => item !== name)
                                : [...prev.categories, name]
                        }))
                    }
                    onReset={() => setDraft({ categories: [], sort: DEFAULT_SEARCH_SORT })}
                    onApply={() => {
                        setSheetOpen(false)
                        pushFilters(href(draft))
                    }}
                    onClose={() => setSheetOpen(false)}
                />
            )}
        </>
    )
}
