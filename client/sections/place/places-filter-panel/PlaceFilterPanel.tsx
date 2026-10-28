import React, { useEffect, useState } from 'react'
import { Button, Icon } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'
import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import {
    CategoryRail,
    FilterPanel,
    FilterPhoneBar,
    FilterPopout,
    FiltersButton,
    FilterToolbar,
    FilterToolbarSpacer
} from '@/components/shared/filter-panel'
import { BottomSheet, OptionList, Switch, Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import { AppliedFilters } from './AppliedFilters'
import { describeFilter, isFilterActive, isNearFilter } from './describeFilter'
import { ANYWHERE_KEY, LocationChoice, NEAR_KEY } from './LocationOptions'
import { ResumeSearch } from './ResumeSearch'
import { getSortLabel, getSortPresets } from './sortPresets'
import { PlacesFilterPatch, PlacesFilterState } from './types'
import { usePlacesFilterMemory } from './usePlacesFilterMemory'

import styles from './styles.module.sass'

// Opened by a tap only: closed on the server and on first paint, so their code loads apart
const LocationOptions = dynamic(() => import('./LocationOptions').then((mod) => mod.LocationOptions), { ssr: false })
const PlaceFiltersSheet = dynamic(() => import('./PlaceFiltersSheet').then((mod) => mod.PlaceFiltersSheet), {
    ssr: false
})

interface PlaceFilterPanelProps {
    filter: PlacesFilterState
    /** The sort with no `?sort=` in the URL: `recommended` signed in, `trending` for a guest */
    defaultSort: ApiType.SortFieldsType
    /** Places found with the applied filters */
    count: number
    /** The listing's URL with a change applied, on its first page */
    buildHref: (patch: PlacesFilterPatch) => string
    /** The big map with the same category, for "Карта" */
    mapHref: string
}

/**
 * The controls of the places listing (DESIGN.md → Patterns → Listing toolbar): three
 * questions — where, what, in which order. Desktop: one row of "Где", the sort and "Скрыть
 * посещённые" with "Список / Карта" on the right, the category rail under it, then the
 * applied filters; filters apply at once. Phones: a search bar "Где искать?" and a round
 * filters button with a counter over the same rail; both open bottom sheets, and a floating
 * "Карта" button sits over the list. The whole block sticks under the app bar.
 */
export const PlaceFilterPanel: React.FC<PlaceFilterPanelProps> = ({
    filter,
    defaultSort,
    count,
    buildHref,
    mapHref
}) => {
    const { t } = useTranslation()
    const router = useRouter()

    const isAuth = !!useAppSelector((state) => state.auth.isAuth)
    const { request: requestUserLocation } = useUserLocation()
    const { lastSearch, recentLocations, rememberLocation, rememberSearch } = usePlacesFilterMemory()

    const [sheet, setSheet] = useState<'location' | 'filters' | null>(null)
    // The filters sheet is loaded on the first tap and kept mounted for its close animation
    const [filtersOpened, setFiltersOpened] = useState(false)

    const near = isNearFilter(filter)
    const summary = describeFilter(t, filter)
    // "Продолжить: …" is offered on a clean listing only
    const showResume = !!lastSearch && !isFilterActive(filter) && !near && filter.sort === defaultSort

    // The last filtered search of this browser, for "Продолжить: …" on a clean listing
    useEffect(() => {
        if (isFilterActive(filter) && summary) {
            rememberSearch({ href: buildHref({}), label: summary })
        }
    }, [summary])

    const go = (patch: PlacesFilterPatch) => void router.push(buildHref(patch))

    const handlePickLocation = async (choice: LocationChoice) => {
        setSheet(null)

        if (choice === NEAR_KEY) {
            // "Рядом со мной" is the distance sort over everything: it asks the browser first
            if (await requestUserLocation()) {
                go({ location: null, sort: ApiType.SortFields.Distance })
            }
            return
        }

        if (choice === ANYWHERE_KEY) {
            go({ location: null, sort: near ? defaultSort : filter.sort })
            return
        }

        rememberLocation(choice)
        go({ location: choice, sort: near ? defaultSort : filter.sort })
    }

    const handlePickSort = async (sort: ApiType.SortFieldsType) => {
        // Sorting by distance is what asks the browser for the location; without it the sort stays
        if (sort === ApiType.SortFields.Distance && !(await requestUserLocation())) {
            return
        }

        go({ sort })
    }

    const locationValue =
        filter.location?.name ?? (near ? t('location-near', 'Рядом со мной') : t('location-anywhere', 'Везде'))
    const sortLabel = getSortLabel(t, filter.sort)
    const badge = filter.categories.length + (filter.sort !== defaultSort ? 1 : 0) + (filter.notVisited ? 1 : 0)

    const locationOptions = (close?: () => void) => (
        <LocationOptions
            location={filter.location}
            near={near}
            recentLocations={recentLocations}
            autoFocus={true}
            onPick={(choice) => {
                close?.()
                void handlePickLocation(choice)
            }}
        />
    )

    const viewTabs = (
        <Tabs
            className={styles.viewTabs}
            aria-label={t('filters-view', 'Вид')}
            activeTab={'list'}
            tabs={[
                { href: buildHref({}), key: 'list', label: t('filters-view-list', 'Список') },
                { href: mapHref, key: 'map', label: t('nav-map', 'Карта') }
            ]}
        />
    )

    return (
        <>
            <FilterPanel sticky={'always'}>
                <FilterToolbar>
                    <FilterPopout
                        width={320}
                        icon={'Point'}
                        label={t('filters-where', 'Где')}
                        value={locationValue}
                        active={!!filter.location || near}
                    >
                        {locationOptions}
                    </FilterPopout>

                    <FilterPopout
                        width={240}
                        icon={'BarChart'}
                        value={sortLabel}
                    >
                        {(close) => (
                            <OptionList
                                groups={[
                                    {
                                        items: getSortPresets(t, isAuth).map((preset) => ({
                                            ...preset,
                                            selected: preset.key === filter.sort
                                        }))
                                    }
                                ]}
                                onSelect={(key) => {
                                    close()
                                    void handlePickSort(key)
                                }}
                            />
                        )}
                    </FilterPopout>

                    {isAuth && (
                        <Switch
                            label={t('filter-not-visited', 'Скрыть посещённые')}
                            checked={filter.notVisited}
                            onChange={(notVisited) => go({ notVisited })}
                        />
                    )}

                    <FilterToolbarSpacer />

                    {showResume && <ResumeSearch lastSearch={lastSearch} />}

                    {viewTabs}
                </FilterToolbar>

                <FilterPhoneBar>
                    <button
                        type={'button'}
                        className={styles.searchBar}
                        onClick={() => setSheet('location')}
                    >
                        <Icon name={'Search'} />
                        <span className={styles.searchBarText}>
                            <b>
                                {filter.location || near ? locationValue : t('filters-where-question', 'Где искать?')}
                            </b>
                            <small>
                                {[
                                    filter.location || near ? null : t('location-anywhere', 'Везде'),
                                    filter.categories.length
                                        ? describeFilter(t, {
                                              ...filter,
                                              location: undefined,
                                              notVisited: false
                                          })
                                        : t('filters-all-categories-long', 'Все категории'),
                                    sortLabel
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </small>
                        </span>
                    </button>

                    <FiltersButton
                        count={badge}
                        onClick={() => {
                            setFiltersOpened(true)
                            setSheet('filters')
                        }}
                    />
                </FilterPhoneBar>

                <CategoryRail
                    selected={filter.categories}
                    hrefFor={(categories) => buildHref({ categories })}
                    // TEMPORARILY (1.17.5), until the rail gets the numbers of places per category:
                    // 90% of the locality / district × category lists were empty, and crawlers
                    // rendered every one of them through these links
                    noLinks={filter.location?.type === 'locality' || filter.location?.type === 'district'}
                />

                <AppliedFilters
                    filter={filter}
                    defaultSort={defaultSort}
                    buildHref={buildHref}
                />
            </FilterPanel>

            <div className={styles.mapButton}>
                <Button
                    mode={'primary'}
                    icon={'Map'}
                    noIndex={true}
                    label={t('nav-map', 'Карта')}
                    link={mapHref}
                />
            </div>

            <BottomSheet
                open={sheet === 'location'}
                title={t('filters-where-question', 'Где искать?')}
                closeOnSelect={false}
                className={styles.sheet}
                onClose={() => setSheet(null)}
            >
                {sheet === 'location' && locationOptions()}
            </BottomSheet>

            {filtersOpened && (
                <PlaceFiltersSheet
                    open={sheet === 'filters'}
                    filter={filter}
                    defaultSort={defaultSort}
                    isAuth={isAuth}
                    count={count}
                    onClose={() => setSheet(null)}
                    onApply={(draft) => {
                        setSheet(null)
                        go(draft)
                    }}
                />
            )}
        </>
    )
}
