import React, { useEffect, useRef, useState } from 'react'
import { Button, Icon, Popout, PopoutHandleProps } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { BottomSheet, FieldTrigger, OptionList, Switch, Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import { AppliedFilters } from './AppliedFilters'
import { CategoryRail } from './CategoryRail'
import { describeFilter, isFilterActive, isNearFilter } from './describeFilter'
import { ANYWHERE_KEY, LocationChoice, LocationOptions, NEAR_KEY } from './LocationOptions'
import { PlaceFiltersSheet } from './PlaceFiltersSheet'
import { getSortLabel, getSortPresets } from './sortPresets'
import { PlacesFilterPatch, PlacesFilterState } from './types'
import { usePlacesFilterMemory } from './usePlacesFilterMemory'

import styles from './styles.module.sass'

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

    const locationPopout = useRef<PopoutHandleProps>(null)
    const sortPopout = useRef<PopoutHandleProps>(null)

    const [sheet, setSheet] = useState<'location' | 'filters' | null>(null)

    const near = isNearFilter(filter)
    const summary = describeFilter(t, filter)

    // The last filtered search of this browser, for "Продолжить: …" on a clean listing
    useEffect(() => {
        if (isFilterActive(filter) && summary) {
            rememberSearch({ href: buildHref({}), label: summary })
        }
    }, [summary])

    const go = (patch: PlacesFilterPatch) => void router.push(buildHref(patch))

    const handlePickLocation = async (choice: LocationChoice) => {
        locationPopout.current?.close()
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
        sortPopout.current?.close()

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

    const locationOptions = (
        <LocationOptions
            location={filter.location}
            near={near}
            recentLocations={recentLocations}
            autoFocus={true}
            onPick={(choice) => void handlePickLocation(choice)}
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
            <div className={styles.panel}>
                <div
                    className={styles.toolbar}
                    role={'toolbar'}
                    aria-label={t('filters', 'Фильтры')}
                >
                    <Popout
                        ref={locationPopout}
                        className={styles.locationField}
                        position={'left'}
                        portal={true}
                        trigger={
                            <FieldTrigger
                                icon={'Point'}
                                label={t('filters-where', 'Где')}
                                value={locationValue}
                                active={!!filter.location || near}
                            />
                        }
                    >
                        <div className={styles.dropdown}>{locationOptions}</div>
                    </Popout>

                    <Popout
                        ref={sortPopout}
                        className={styles.sortField}
                        position={'left'}
                        portal={true}
                        trigger={
                            <FieldTrigger
                                icon={'BarChart'}
                                value={sortLabel}
                            />
                        }
                    >
                        <div className={styles.dropdown}>
                            <OptionList
                                groups={[
                                    {
                                        items: getSortPresets(t, isAuth).map((preset) => ({
                                            ...preset,
                                            selected: preset.key === filter.sort
                                        }))
                                    }
                                ]}
                                onSelect={(key) => void handlePickSort(key)}
                            />
                        </div>
                    </Popout>

                    {isAuth && (
                        <Switch
                            label={t('filter-not-visited', 'Скрыть посещённые')}
                            checked={filter.notVisited}
                            onChange={(notVisited) => go({ notVisited })}
                        />
                    )}

                    <span className={styles.spacer} />

                    {viewTabs}
                </div>

                <div className={styles.mobileBar}>
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
                                              notVisited: false,
                                              tag: undefined
                                          })
                                        : t('filters-all-categories-long', 'Все категории'),
                                    sortLabel
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </small>
                        </span>
                    </button>

                    <button
                        type={'button'}
                        className={styles.filtersButton}
                        aria-label={
                            badge
                                ? t('filters-with-count', 'Фильтры, выбрано: {{count}}', { count: badge })
                                : t('filters', 'Фильтры')
                        }
                        onClick={() => setSheet('filters')}
                    >
                        <Icon name={'Tune'} />
                        {!!badge && (
                            <span
                                className={styles.filtersBadge}
                                aria-hidden={true}
                            >
                                {badge}
                            </span>
                        )}
                    </button>
                </div>

                <CategoryRail
                    categories={filter.categories}
                    buildHref={buildHref}
                />

                <AppliedFilters
                    filter={filter}
                    defaultSort={defaultSort}
                    lastSearch={lastSearch}
                    buildHref={buildHref}
                />
            </div>

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
                {sheet === 'location' && locationOptions}
            </BottomSheet>

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
        </>
    )
}
