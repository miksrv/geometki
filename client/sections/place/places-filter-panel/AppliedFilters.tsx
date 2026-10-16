import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { AppliedFilterList } from '@/components/shared/filter-panel'
import type { AppliedFilter } from '@/components/shared/filter-panel/AppliedFilterList'
import { categoryImage, getCategoryShortTitle } from '@/utils/categories'

import { isFilterActive, isNearFilter } from './describeFilter'
import { getSortLabel } from './sortPresets'
import { PlacesFilterPatch, PlacesFilterState } from './types'

interface AppliedFiltersProps {
    filter: PlacesFilterState
    defaultSort: ApiType.SortFieldsType
    buildHref: (patch: PlacesFilterPatch) => string
}

/**
 * What is applied, as removable chips with "Сбросить всё"; with nothing applied, nothing
 * (the "Продолжить: …" link lives in the toolbar row, see `ResumeSearch`).
 */
export const AppliedFilters: React.FC<AppliedFiltersProps> = ({ filter, defaultSort, buildHref }) => {
    const { t } = useTranslation()

    const near = isNearFilter(filter)
    const sortChanged = filter.sort !== defaultSort && !near

    if (!isFilterActive(filter) && !sortChanged && !near) {
        return null
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
                    unoptimized={true}
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
