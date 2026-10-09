import React, { useMemo } from 'react'
import { Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { getCategoryOptions } from '@/utils/categories'

import styles from './styles.module.sass'

export interface SearchPageQuery {
    q: string
    type?: ApiType.Search.Request['type']
    category?: string
    sort?: ApiType.Search.Request['sort']
    order?: ApiType.Search.Request['order']
}

interface SearchFiltersProps {
    query: SearchPageQuery
    onChange: (key: keyof SearchPageQuery, value: string) => void
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({ query, onChange }) => {
    const { t } = useTranslation()

    const typeOptions: Array<SelectOptionType<string>> = [
        { key: 'all', value: t('search-filter-type-all', { defaultValue: 'Все' }) },
        { key: 'location', value: t('search-filter-type-location', { defaultValue: 'Адреса' }) },
        { key: 'coordinates', value: t('search-filter-type-coordinates', { defaultValue: 'Координаты' }) },
        { key: 'places', value: t('search-filter-type-places', { defaultValue: 'Интересные места' }) }
    ]

    const categoryOptions: Array<SelectOptionType<string>> = useMemo(
        () => [
            { key: '', value: t('all', { defaultValue: 'Все' }) },
            ...getCategoryOptions(t).map((option) => ({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                image: option.image as any,
                key: option.key as string,
                value: option.value
            }))
        ],
        [t]
    )

    const sortOptions: Array<SelectOptionType<string>> = [
        { key: 'relevance', value: t('search-sort-relevance', { defaultValue: 'По релевантности' }) },
        { key: 'distance', value: t('search-sort-distance', { defaultValue: 'По расстоянию' }) },
        { key: 'views', value: t('search-sort-views', { defaultValue: 'По просмотрам' }) },
        { key: 'rating', value: t('search-sort-rating', { defaultValue: 'По рейтингу' }) },
        { key: 'created_at', value: t('search-sort-date', { defaultValue: 'По дате' }) }
    ]

    return (
        <div className={styles.filters}>
            <Select<string>
                placeholder={t('search-filter-type', { defaultValue: 'Тип' })}
                options={typeOptions}
                value={query.type ?? 'all'}
                onSelect={(selected) => {
                    if (selected?.[0]) {
                        onChange('type', selected[0].key)
                    }
                }}
            />

            <Select<string>
                clearable={true}
                placeholder={t('search-filter-category', { defaultValue: 'Категория' })}
                options={categoryOptions}
                value={query.category || undefined}
                onSelect={(selected) => {
                    onChange('category', selected?.[0]?.key ?? '')
                }}
            />

            <Select<string>
                placeholder={t('search-filter-sort', { defaultValue: 'Сортировка' })}
                options={sortOptions}
                value={query.sort ?? 'relevance'}
                onSelect={(selected) => {
                    if (selected?.[0]) {
                        onChange('sort', selected[0].key)
                    }
                }}
            />
        </div>
    )
}
