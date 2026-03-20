import React, { useMemo } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'

import { encodeQueryData } from '@/utils/helpers'

import { computePageNumbers } from '@/utils/pagination'

import styles from './styles.module.sass'

const LEFT_PAGE = 'LEFT'
const RIGHT_PAGE = 'RIGHT'

export interface PaginationProps<T> {
    currentPage?: number
    totalItemsCount?: number
    linkPart?: string
    captionPage?: string
    captionNextPage?: string
    captionPrevPage?: string
    urlParam?: T
    perPage?: number
    neighbours?: number
    disableScroll?: boolean
    hideIfOnePage?: boolean
    hideArrows?: boolean
    onChangePage?: (page: number) => void
}

export const Pagination = <T,>({
    currentPage = 1,
    totalItemsCount = 0,
    linkPart,
    captionPage,
    captionNextPage,
    captionPrevPage,
    urlParam,
    disableScroll,
    hideIfOnePage,
    hideArrows,
    perPage = 4,
    neighbours = 2,
    onChangePage
}: PaginationProps<T>) => {
    const pageNeighbours = Math.max(0, Math.min(neighbours, 2))
    const totalPages = Math.ceil(totalItemsCount / perPage)

    const link = `/${linkPart}`

    const fetchPageNumbers: Array<string | number> = useMemo(
        () => computePageNumbers(currentPage, totalPages, pageNeighbours),
        [currentPage, pageNeighbours, totalPages]
    )

    return hideIfOnePage && totalPages === 1 ? (
        <></>
    ) : (
        <nav
            aria-label={'Pages Pagination'}
            className={styles.pagination}
        >
            {fetchPageNumbers
                .filter((page) => (!hideArrows ? true : page !== RIGHT_PAGE && page !== LEFT_PAGE))
                .map((page) => (
                    <Link
                        scroll={!disableScroll}
                        className={cn(styles.item, currentPage === page ? styles.active : undefined)}
                        href={
                            page === RIGHT_PAGE
                                ? `${link}${encodeQueryData({
                                      ...urlParam,
                                      page: currentPage + 1
                                  })}`
                                : page === LEFT_PAGE
                                  ? `${link}${encodeQueryData({
                                        ...urlParam,
                                        page: currentPage - 1
                                    })}`
                                  : page === 1
                                    ? `${link}${encodeQueryData({
                                          ...urlParam,
                                          page: undefined
                                      })}`
                                    : `${link}${encodeQueryData({
                                          ...urlParam,
                                          page
                                      })}`
                        }
                        title={
                            page === RIGHT_PAGE
                                ? (captionNextPage ?? 'Next page')
                                : page === LEFT_PAGE
                                  ? (captionPrevPage ?? 'Previous page')
                                  : `${captionPage ?? 'Page'} - ${page}`
                        }
                        key={page}
                        onClick={(event) => {
                            if (onChangePage) {
                                event.preventDefault()
                                onChangePage(Number(page))
                            }
                        }}
                    >
                        {page === RIGHT_PAGE ? (
                            <Icon name={'KeyboardRight'} />
                        ) : page === LEFT_PAGE ? (
                            <Icon name={'KeyboardLeft'} />
                        ) : (
                            <>{page}</>
                        )}
                    </Link>
                ))}
        </nav>
    )
}

export { computePageNumbers, range } from '@/utils/pagination'
