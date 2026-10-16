import type { TFunction } from 'i18next'

import { ApiType } from '@/api'
import { getCategoryShortTitle } from '@/utils/categories'
import { buildPlacesHref, LandingFlags } from '@/utils/placesLanding'

import { PlacesFilterPatch, PlacesFilterState } from './types'

/** Something narrows the list: the "applied" row, the memory and the badge care about this */
export const isFilterActive = (filter: PlacesFilterState): boolean =>
    !!(filter.location || filter.categories.length || filter.notVisited || filter.tag)

/** "Рядом со мной": no location, nearest first */
export const isNearFilter = (filter: PlacesFilterState): boolean =>
    !filter.location && filter.sort === ApiType.SortFields.Distance

/** A one-line summary of a search: "Заброшки, Пещеры +1 · Оренбургская область · без посещённых" */
export const describeFilter = (t: TFunction, filter: PlacesFilterState): string => {
    const parts: string[] = []

    if (filter.categories.length) {
        const names = filter.categories.map((name) => getCategoryShortTitle(t, name))
        parts.push(names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : ''))
    }

    if (filter.location) {
        parts.push(filter.location.name)
    } else if (isNearFilter(filter)) {
        parts.push(t('location-near', 'Рядом со мной'))
    }

    if (filter.tag) {
        parts.push(`#${filter.tag}`)
    }

    if (filter.notVisited) {
        parts.push(t('filter-not-visited-short', 'без посещённых'))
    }

    return parts.join(' · ')
}

/** The API request behind a filter state: the count of the sheet's "Показать N мест" */
export const filterToListRequest = (filter: PlacesFilterState): ApiType.Places.ListRequest => ({
    category: filter.categories.length ? filter.categories.join(',') : undefined,
    [filter.location?.type ?? 'locality']: filter.location?.id,
    notVisited: filter.notVisited ? 1 : undefined,
    tag: filter.tag
})

/** The filter state with a change applied (`location: null` / `tag: null` clear them) */
export const applyFilterPatch = (filter: PlacesFilterState, patch: PlacesFilterPatch): PlacesFilterState => ({
    categories: patch.categories ?? filter.categories,
    location: 'location' in patch ? (patch.location ?? undefined) : filter.location,
    notVisited: patch.notVisited ?? filter.notVisited,
    sort: patch.sort ?? filter.sort,
    tag: 'tag' in patch ? (patch.tag ?? undefined) : filter.tag
})

interface FilterHrefOptions {
    defaultSort: ApiType.SortFieldsType
    defaultOrder: ApiType.SortOrdersType
    /** The current `?order=` of an old URL: kept until the sort changes */
    order?: ApiType.SortOrdersType
    lat?: number | null
    lon?: number | null
    flags: LandingFlags
}

/**
 * The listing URL for the filter state with a change applied, always on its first page: a
 * new filter is a new list. The canonical path comes from `buildPlacesHref`, so a location with
 * a slug and a single category land on their pages when the landing flags are on.
 */
export const buildFilterHref = (
    filter: PlacesFilterState,
    patch: PlacesFilterPatch,
    { defaultSort, defaultOrder, order, lat, lon, flags }: FilterHrefOptions
): string => {
    const next = applyFilterPatch(filter, patch)

    return buildPlacesHref(
        {
            category: next.categories,
            defaultOrder,
            defaultSort,
            lat,
            location: next.location
                ? { id: next.location.id, slug: next.location.slug ?? null, type: next.location.type ?? 'locality' }
                : null,
            lon,
            notVisited: next.notVisited,
            // The presets have no order: picking one drops the `?order=` of an old link
            order: patch.sort !== undefined ? undefined : order,
            sort: next.sort,
            tag: next.tag
        },
        flags
    ).href
}
