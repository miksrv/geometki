import React, { useEffect, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { BottomSheet, Switch } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'
import { CATEGORY_GROUPS, categoryImage, getCategoryGroupTitle, getCategoryShortTitle } from '@/utils/categories'

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
 * The phone filters: the sort presets, every category in its group, "Скрыть посещённые".
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
        <BottomSheet
            open={open}
            title={t('filters', 'Фильтры')}
            closeOnSelect={false}
            className={styles.sheet}
            onClose={onClose}
            footer={
                <>
                    <Button
                        mode={'secondary'}
                        size={'large'}
                        label={t('filters-reset', 'Сбросить')}
                        onClick={() =>
                            setDraft({ categories: [], notVisited: false, sort: defaultSort, tag: undefined })
                        }
                    />
                    <Button
                        mode={'primary'}
                        size={'large'}
                        stretched={true}
                        loading={changed && isFetching}
                        disabled={changed && !isFetching && total === 0}
                        label={
                            total
                                ? t('filters-show-count', 'Показать {{count}} мест', { count: total })
                                : t('filters-show-none', 'Ничего не найдено')
                        }
                        onClick={() => onApply(draft)}
                    />
                </>
            }
        >
            <h3 className={styles.sheetHeading}>{t('filters-sort', 'Сортировка')}</h3>
            <div className={styles.sheetPills}>
                {getSortPresets(t, isAuth).map((preset) => (
                    <button
                        key={preset.key}
                        type={'button'}
                        className={cn(styles.sheetPill, draft.sort === preset.key && styles.sheetPillOn)}
                        aria-pressed={draft.sort === preset.key}
                        onClick={() => void handleSort(preset.key)}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <h3 className={styles.sheetHeading}>{t('categories')}</h3>
            {CATEGORY_GROUPS.map((group) => (
                <div
                    key={group.name}
                    role={'group'}
                    aria-label={getCategoryGroupTitle(t, group.name)}
                >
                    <div
                        className={styles.sheetGroup}
                        aria-hidden={true}
                    >
                        {getCategoryGroupTitle(t, group.name)}
                    </div>
                    <div className={styles.sheetCategories}>
                        {group.categories.map((name) => (
                            <button
                                key={name}
                                type={'button'}
                                className={cn(
                                    styles.sheetCategory,
                                    draft.categories.includes(name) && styles.sheetCategoryOn
                                )}
                                aria-pressed={draft.categories.includes(name)}
                                onClick={() => toggleCategory(name)}
                            >
                                <Image
                                    src={categoryImage(name).src}
                                    alt={''}
                                    width={28}
                                    height={28}
                                />
                                {getCategoryShortTitle(t, name)}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

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
        </BottomSheet>
    )
}
