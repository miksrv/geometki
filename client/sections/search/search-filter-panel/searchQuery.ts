import type { TFunction } from 'i18next'
import type { ParsedUrlQuery } from 'querystring'

import { ApiModel, ApiType } from '@/api'

export type SearchResultType = NonNullable<ApiType.Search.Request['type']>

/** The search as the URL holds it: the URL is the only state of the page */
export interface SearchQuery {
    q: string
    /** Which results to show; the API is always asked for all of them, so the tabs have numbers */
    type: SearchResultType
    categories: string[]
    sort: ApiType.Search.SortType
}

export type SearchQueryPatch = Partial<Omit<SearchQuery, 'q'>>

export const DEFAULT_SEARCH_SORT: ApiType.Search.SortType = 'relevance'

const TYPES: SearchResultType[] = ['all', 'places', 'location', 'coordinates']

const SORTS: ApiType.Search.SortType[] = ['relevance', 'distance', 'rating', 'views', 'created_at', 'comments']

const first = (value?: string | string[]): string => (Array.isArray(value) ? value[0] : value) ?? ''

export const parseSearchQuery = (query: ParsedUrlQuery): SearchQuery => {
    const type = first(query.type) as SearchResultType
    const sort = first(query.sort) as ApiType.Search.SortType
    const known = Object.values(ApiModel.Categories) as string[]

    return {
        categories: first(query.category)
            .split(',')
            .map((name) => name.trim())
            .filter((name, index, all) => known.includes(name) && all.indexOf(name) === index),
        q: first(query.q).trim(),
        sort: SORTS.includes(sort) ? sort : DEFAULT_SEARCH_SORT,
        type: TYPES.includes(type) ? type : 'all'
    }
}

/** The search URL with a change applied; defaults stay out of it */
export const buildSearchHref = (query: SearchQuery, patch: SearchQueryPatch = {}): string => {
    const next = { ...query, ...patch }
    const params = new URLSearchParams({ q: next.q })

    if (next.type !== 'all') {
        params.set('type', next.type)
    }

    if (next.categories.length) {
        params.set('category', next.categories.join(','))
    }

    if (next.sort !== DEFAULT_SEARCH_SORT) {
        params.set('sort', next.sort)
    }

    return `/search?${params.toString()}`
}

export interface SearchSortPreset {
    key: ApiType.Search.SortType
    label: string
    caption?: string
}

/** The sorts of the found places as ready answers, each in its natural direction */
export const getSearchSortPresets = (t: TFunction): SearchSortPreset[] => [
    {
        caption: t('sort-preset-relevance-caption', 'Лучше всего совпадают с запросом'),
        key: 'relevance',
        label: t('sort-preset-relevance', 'Самые подходящие')
    },
    {
        caption: t('sort-preset-distance-caption', 'Спросим, где вы'),
        key: 'distance',
        label: t('sort-preset-distance', 'Ближе ко мне')
    },
    { key: 'rating', label: t('sort-preset-rating', 'Лучший рейтинг') },
    {
        caption: t('sort-preset-views-caption', 'За всё время'),
        key: 'views',
        label: t('sort-preset-views', 'Самые просматриваемые')
    },
    {
        caption: t('sort-preset-created-caption', 'Недавно добавленные'),
        key: 'created_at',
        label: t('sort-preset-created', 'Новые')
    },
    {
        caption: t('sort-preset-comments-caption', 'Больше всего отзывов'),
        key: 'comments',
        label: t('sort-preset-comments', 'Обсуждаемые')
    }
]

/** Found places with these categories, from the facets; none — all found places */
export const countFacets = (counts: Record<string, number> | undefined, categories: string[]): number =>
    Object.entries(counts ?? {}).reduce(
        (sum, [name, count]) => (!categories.length || categories.includes(name) ? sum + count : sum),
        0
    )
