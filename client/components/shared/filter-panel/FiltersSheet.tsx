import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { BottomSheet } from '@/components/ui'
import { CATEGORY_GROUPS, categoryImage, getCategoryGroupTitle, getCategoryShortTitle } from '@/utils/categories'

import styles from './styles.module.sass'

interface FiltersSheetProps<S extends string> {
    open: boolean
    /** The sorts as pills; none — no sort section */
    sorts?: Array<{ key: S; label: string }>
    sort?: S
    /** The categories on in the draft */
    categories: string[]
    /** Facets: only the categories with places (and those on), with their numbers */
    counts?: Record<string, number>
    /** Places with the draft: "Показать N мест" */
    total: number
    /** The number is being counted */
    counting?: boolean
    /** A draft change made nothing found: the button is off */
    nothingFound?: boolean
    onSort?: (sort: S) => void
    onToggleCategory: (name: string) => void
    onReset: () => void
    onApply: () => void
    onClose: () => void
    /** Rows after the categories ("Скрыть посещённые") */
    children?: React.ReactNode
}

/**
 * The phone filters as a form sheet: the sort pills, the categories as a grid by group, the
 * page's own rows. The page keeps the draft; nothing applies until "Показать N мест".
 */
export const FiltersSheet = <S extends string>({
    open,
    sorts,
    sort,
    categories,
    counts,
    total,
    counting,
    nothingFound,
    onSort,
    onToggleCategory,
    onReset,
    onApply,
    onClose,
    children
}: FiltersSheetProps<S>) => {
    const { t } = useTranslation()

    const groups = CATEGORY_GROUPS.map((group) => ({
        ...group,
        categories: counts
            ? group.categories.filter((name) => counts[name] || categories.includes(name))
            : group.categories
    })).filter((group) => group.categories.length)

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
                        onClick={onReset}
                    />
                    <Button
                        mode={'primary'}
                        size={'large'}
                        stretched={true}
                        loading={counting}
                        disabled={nothingFound}
                        label={
                            total
                                ? t('filters-show-count', 'Показать {{count}} мест', { count: total })
                                : t('filters-show-none', 'Ничего не найдено')
                        }
                        onClick={onApply}
                    />
                </>
            }
        >
            {!!sorts?.length && (
                <>
                    <h3 className={styles.sheetHeading}>{t('filters-sort', 'Сортировка')}</h3>
                    <div className={styles.sheetPills}>
                        {sorts.map((preset) => (
                            <button
                                key={preset.key}
                                type={'button'}
                                className={cn(styles.sheetPill, sort === preset.key && styles.sheetPillOn)}
                                aria-pressed={sort === preset.key}
                                onClick={() => onSort?.(preset.key)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {!!groups.length && <h3 className={styles.sheetHeading}>{t('categories')}</h3>}
            {groups.map((group) => (
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
                                    categories.includes(name) && styles.sheetCategoryOn
                                )}
                                aria-pressed={categories.includes(name)}
                                onClick={() => onToggleCategory(name)}
                            >
                                <Image
                                    src={categoryImage(name).src}
                                    alt={''}
                                    width={28}
                                    height={28}
                                />
                                {getCategoryShortTitle(t, name)}
                                {counts && <span className={styles.sheetCount}>{counts[name] ?? 0}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {children}
        </BottomSheet>
    )
}
