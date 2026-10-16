import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { AppliedFilterList, AppliedFilterRow } from '@/components/shared/filter-panel'
import type { AppliedFilter } from '@/components/shared/filter-panel/AppliedFilterList'
import { categoryImage, getCategoryShortTitle } from '@/utils/categories'

import { isFilterActive, isNearFilter } from './describeFilter'
import { getSortLabel } from './sortPresets'
import { PlacesFilterPatch, PlacesFilterState } from './types'
import { LastPlacesSearch } from './usePlacesFilterMemory'

import styles from './styles.module.sass'

interface AppliedFiltersProps {
    filter: PlacesFilterState
    defaultSort: ApiType.SortFieldsType
    lastSearch?: LastPlacesSearch | null
    buildHref: (patch: PlacesFilterPatch) => string
}

/**
 * What is applied, as removable chips with "Сбросить всё". With nothing applied,
 * the last search of this browser as a dashed "Продолжить: …" link — remembered, never
 * applied by itself.
 */
export const AppliedFilters: React.FC<AppliedFiltersProps> = ({ filter, defaultSort, lastSearch, buildHref }) => {
    const { t } = useTranslation()

    const near = isNearFilter(filter)
    const sortChanged = filter.sort !== defaultSort && !near

    if (!isFilterActive(filter) && !sortChanged && !near) {
        return lastSearch ? (
            <AppliedFilterRow>
                <Link
                    href={lastSearch.href}
                    className={styles.resume}
                >
                    <Icon name={'Time'} />
                    {t('filters-resume', 'Продолжить:')} <b>{lastSearch.label}</b>
                </Link>
            </AppliedFilterRow>
        ) : null
    }

    const filters: AppliedFilter[] = []

    if (filter.location) {
        filters.push({
            href: buildHref({ location: null }),
            icon: <Icon name={'Point'} />,
            key: 'location',
            label: filter.location.name
        })
    }

    if (near) {
        filters.push({
            href: buildHref({ sort: defaultSort }),
            icon: <Icon name={'Position'} />,
            key: 'near',
            label: t('location-near', 'Рядом со мной')
        })
    }

    filter.categories.forEach((name) =>
        filters.push({
            href: buildHref({ categories: filter.categories.filter((item) => item !== name) }),
            icon: (
                <Image
                    src={categoryImage(name as ApiModel.Categories).src}
                    alt={''}
                    width={16}
                    height={16}
                />
            ),
            key: `category-${name}`,
            label: getCategoryShortTitle(t, name)
        })
    )

    if (filter.tag) {
        filters.push({ href: buildHref({ tag: null }), key: 'tag', label: `#${filter.tag}` })
    }

    if (filter.notVisited) {
        filters.push({
            href: buildHref({ notVisited: false }),
            key: 'notVisited',
            label: t('filter-not-visited-chip', 'Без посещённых')
        })
    }

    if (sortChanged) {
        filters.push({
            href: buildHref({ sort: defaultSort }),
            icon: <Icon name={'BarChart'} />,
            key: 'sort',
            label: getSortLabel(t, filter.sort)
        })
    }

    return (
        <AppliedFilterList
            filters={filters}
            resetHref={buildHref({
                categories: [],
                location: null,
                notVisited: false,
                sort: defaultSort,
                tag: null
            })}
        />
    )
}
