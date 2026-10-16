import React, { useEffect, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { FiltersSheet } from '@/components/shared/filter-panel'
import { Switch } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import { filterToListRequest } from './describeFilter'
import { getSortPresets } from './sortPresets'
import { PlacesFilterState } from './types'

import styles from './styles.module.sass'

const COUNT_DEBOUNCE_MS = 350

interface PlaceFiltersSheetProps {
    open: boolean
    filter: PlacesFilterState
    defaultSort: ApiType.SortFieldsType
    isAuth: boolean
    /** Places with the applied filters: the button's number before anything changes */
    count: number
    onApply: (filter: PlacesFilterState) => void
    onClose: () => void
}

/**
 * The phone filters (`FiltersSheet`): the sort presets, every category, "Скрыть посещённые".
 * Changes stay a draft until "Показать N мест" — the list does not reload on every tap; the
 * number is counted for the draft as it changes.
 */
export const PlaceFiltersSheet: React.FC<PlaceFiltersSheetProps> = ({
    open,
    filter,
    defaultSort,
    isAuth,
    count,
    onApply,
    onClose
}) => {
    const { t } = useTranslation()
    const { request: requestUserLocation } = useUserLocation()

    const [draft, setDraft] = useState<PlacesFilterState>(filter)
    const [countPlaces, { data: counted, isFetching }] = API.useLazyPlacesGetListQuery()

    useEffect(() => {
        if (open) {
            setDraft(filter)
        }
    }, [open])

    const changed = draft.categories.join(',') !== filter.categories.join(',') || draft.notVisited !== filter.notVisited

    useEffect(() => {
        if (!open || !changed) {
            return
        }

        const timer = setTimeout(
            () => void countPlaces({ ...filterToListRequest(draft), limit: 1 }, true),
            COUNT_DEBOUNCE_MS
        )

        return () => clearTimeout(timer)
    }, [open, changed, draft.categories.join(','), draft.notVisited])

    const total = changed ? (counted?.count ?? count) : count

    const toggleCategory = (name: string) =>
        setDraft((prev) => ({
            ...prev,
            categories: prev.categories.includes(name)
                ? prev.categories.filter((item) => item !== name)
                : [...prev.categories, name]
        }))

    const handleSort = async (sort: ApiType.SortFieldsType) => {
        // Sorting by distance is what asks the browser for the location; without it the sort stays
        if (sort === ApiType.SortFields.Distance && !(await requestUserLocation())) {
            return
        }

        setDraft((prev) => ({ ...prev, sort }))
    }

    return (
        <FiltersSheet
            open={open}
            sorts={getSortPresets(t, isAuth)}
            sort={draft.sort}
            categories={draft.categories}
            total={total}
            counting={changed && isFetching}
            nothingFound={changed && !isFetching && total === 0}
            onSort={(sort) => void handleSort(sort)}
            onToggleCategory={toggleCategory}
            onReset={() => setDraft({ categories: [], notVisited: false, sort: defaultSort, tag: undefined })}
            onApply={() => onApply(draft)}
            onClose={onClose}
        >
            {isAuth && (
                <Switch
                    variant={'row'}
                    className={styles.sheetSwitch}
                    label={t('filter-not-visited', 'Скрыть посещённые')}
                    description={t('filter-not-visited-caption', 'Места, где вы отметились «Я здесь был(а)»')}
                    checked={draft.notVisited}
                    onChange={(notVisited) => setDraft((prev) => ({ ...prev, notVisited }))}
                />
            )}
        </FiltersSheet>
    )
}
