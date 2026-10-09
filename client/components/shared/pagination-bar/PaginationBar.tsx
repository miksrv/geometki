import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import type { PaginationProps } from '@/components/ui'
// Two lint rules disagree on importing both a value and a type from the same module — see the
// identical note in `proxy.ts`.
// eslint-disable-next-line no-duplicate-imports
import { Pagination } from '@/components/ui'

import styles from './styles.module.sass'

type PaginationBarProps<T> = Omit<PaginationProps<T>, 'captionPage' | 'captionNextPage' | 'captionPrevPage'>

/**
 * The row under a paginated list (DESIGN.md → Patterns → Pagination bar): the range of
 * the items on this page ("22–42 из 132") on the left, the page links on the right, on the
 * page background like the rest of the page chrome. Renders nothing when everything fits
 * on one page — the total is already in the page header's meta line.
 */
export const PaginationBar = <T,>({
    currentPage = 1,
    totalItemsCount = 0,
    perPage = 21,
    ...paginationProps
}: PaginationBarProps<T>) => {
    const { t } = useTranslation()

    if (totalItemsCount <= perPage) {
        return null
    }

    const from = (currentPage - 1) * perPage + 1
    const to = Math.min(currentPage * perPage, totalItemsCount)

    return (
        <div className={styles.component}>
            <div className={styles.range}>
                {t('pagination-range', '{{from}}–{{to}} of {{total}}', { from, to, total: totalItemsCount })}
            </div>
            <Pagination
                currentPage={currentPage}
                totalItemsCount={totalItemsCount}
                perPage={perPage}
                captionPage={t('page')}
                captionNextPage={t('next-page')}
                captionPrevPage={t('prev-page')}
                {...paginationProps}
            />
        </div>
    )
}
