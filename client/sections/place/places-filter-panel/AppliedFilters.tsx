import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { Chip } from '@/components/ui'
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
 * What is applied, one removable chip per filter, and "Сбросить всё". With nothing applied,
 * the last search of this browser as a dashed "Продолжить: …" link — remembered, never
 * applied by itself.
 */
export const AppliedFilters: React.FC<AppliedFiltersProps> = ({ filter, defaultSort, lastSearch, buildHref }) => {
    const { t } = useTranslation()

    const near = isNearFilter(filter)
    const sortChanged = filter.sort !== defaultSort && !near

    if (!isFilterActive(filter) && !sortChanged && !near) {
        return lastSearch ? (
            <div className={styles.applied}>
                <Link
                    href={lastSearch.href}
                    className={styles.resume}
                >
                    <Icon name={'Time'} />
                    {t('filters-resume', 'Продолжить:')} <b>{lastSearch.label}</b>
                </Link>
            </div>
        ) : null
    }

    const removeLabel = (name: string) => t('filters-remove', 'Убрать фильтр: {{name}}', { name })

    return (
        <div className={styles.applied}>
            {filter.location && (
                <Chip
                    size={'small'}
                    removable={true}
                    icon={<Icon name={'Point'} />}
                    label={filter.location.name}
                    aria-label={removeLabel(filter.location.name)}
                    href={buildHref({ location: null })}
                />
            )}

            {near && (
                <Chip
                    size={'small'}
                    removable={true}
                    icon={<Icon name={'Position'} />}
                    label={t('location-near', 'Рядом со мной')}
                    aria-label={removeLabel(t('location-near', 'Рядом со мной'))}
                    href={buildHref({ sort: defaultSort })}
                />
            )}

            {filter.categories.map((name) => (
                <Chip
                    key={name}
                    size={'small'}
                    removable={true}
                    icon={
                        <Image
                            src={categoryImage(name as ApiModel.Categories).src}
                            alt={''}
                            width={16}
                            height={16}
                        />
                    }
                    label={getCategoryShortTitle(t, name)}
                    aria-label={removeLabel(getCategoryShortTitle(t, name))}
                    href={buildHref({ categories: filter.categories.filter((item) => item !== name) })}
                />
            ))}

            {filter.tag && (
                <Chip
                    size={'small'}
                    removable={true}
                    label={`#${filter.tag}`}
                    aria-label={removeLabel(`#${filter.tag}`)}
                    href={buildHref({ tag: null })}
                />
            )}

            {filter.notVisited && (
                <Chip
                    size={'small'}
                    removable={true}
                    label={t('filter-not-visited-chip', 'Без посещённых')}
                    aria-label={removeLabel(t('filter-not-visited-chip', 'Без посещённых'))}
                    href={buildHref({ notVisited: false })}
                />
            )}

            {sortChanged && (
                <Chip
                    size={'small'}
                    removable={true}
                    icon={<Icon name={'BarChart'} />}
                    label={getSortLabel(t, filter.sort)}
                    aria-label={removeLabel(getSortLabel(t, filter.sort))}
                    href={buildHref({ sort: defaultSort })}
                />
            )}

            <Link
                href={buildHref({
                    categories: [],
                    location: null,
                    notVisited: false,
                    sort: defaultSort,
                    tag: null
                })}
                className={styles.reset}
            >
                {t('filters-reset-all', 'Сбросить всё')}
            </Link>
        </div>
    )
}
