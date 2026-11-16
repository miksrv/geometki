import React from 'react'
import { cn, Container, Table, TableColumnProps } from 'simple-react-ui-kit'

import Link from 'next/link'

import { EmptyState } from '../empty-state'

import styles from './styles.module.sass'

export interface AdminTableColumn<T> {
    /** Identifies the column; also the field a sortable column sorts the list by */
    key: keyof T & string
    header: string
    /** The cell of a row */
    render: (row: T) => React.ReactNode
    /** Sorted by the server: clicking the header calls `onSort` with `key` */
    sortable?: boolean
    /** `image`: a narrow cell of a picture; `number`: a count, right-aligned in tabular figures */
    variant?: 'image' | 'number'
}

export interface AdminTableSort<T> {
    key: keyof T
    direction: 'asc' | 'desc'
}

export interface AdminTableProps<T> {
    rows?: T[]
    columns: Array<AdminTableColumn<T>>
    loading?: boolean
    /** The list failed to load: said instead of the empty state, which would invite a duplicate */
    error?: string
    /** Nothing to list: the empty state's title, and a line under it */
    emptyTitle: string
    emptyDescription?: string
    /** The way out of an empty list: "Создать сезон" */
    emptyAction?: React.ReactNode
    sort?: AdminTableSort<T>
    onSort?: (key: keyof T) => void
}

/**
 * The table of an admin list (DESIGN.md → Admin): typed columns with `render(row)`, skeleton rows
 * while loading, an `EmptyState` (with the create action) when there is nothing, and a
 * horizontal scroll on narrow screens (the kit `Table` scrolls its own container). The
 * sort is the server's: pass `sort` and `onSort`. On a page that fits the viewport
 * (`AdminPageShell fit`) the card shrinks to the room left and the rows scroll inside it,
 * under the sticky header.
 */
export const AdminTable = <T,>({
    rows,
    columns,
    loading,
    error,
    emptyTitle,
    emptyDescription,
    emptyAction,
    sort,
    onSort
}: AdminTableProps<T>) => {
    if (!loading && !rows?.length && error) {
        return (
            <Container>
                <EmptyState
                    title={error}
                    description={''}
                />
            </Container>
        )
    }

    if (!loading && !rows?.length) {
        return (
            <Container>
                <EmptyState
                    title={emptyTitle}
                    description={emptyDescription ?? ''}
                    action={emptyAction}
                />
            </Container>
        )
    }

    const tableColumns: Array<TableColumnProps<T>> = columns.map((column) => ({
        accessor: column.key,
        className: cn(column.variant === 'image' && styles.imageCell, column.variant === 'number' && styles.numberCell),
        formatter: (_, sortedRows, index) => column.render(sortedRows[index]),
        header: column.header,
        onChangeSort: column.sortable && onSort ? () => onSort(column.key) : undefined
    }))

    return (
        <Container className={styles.container}>
            <Table<T>
                data={rows ?? []}
                columns={tableColumns}
                className={styles.table}
                loading={loading}
                sort={sort}
                stickyHeader
            />
        </Container>
    )
}

interface AdminTitleCellProps {
    /** The edit page of the row; without it pass `onClick` — the title opens a dialog */
    href?: string
    onClick?: () => void
    title: string
    /** A state that sets the row apart, right after the title: "Выключено" */
    badge?: React.ReactNode
    /** Secondary lines under the title: dates, a description */
    children?: React.ReactNode
}

/**
 * The name cell of an admin list, its first column: the title is the one way into the row — a
 * link to the edit page, or a button that opens the row's dialog — with secondary lines under it.
 * There is no separate "edit" button in a row.
 */
export const AdminTitleCell: React.FC<AdminTitleCellProps> = ({ href, onClick, title, badge, children }) => (
    <div className={styles.titleCell}>
        <span className={styles.titleLine}>
            {href ? (
                <Link href={href}>{title}</Link>
            ) : (
                <button
                    type={'button'}
                    className={styles.titleButton}
                    onClick={onClick}
                >
                    {title}
                </button>
            )}
            {badge}
        </span>
        {children && <span className={styles.titleMeta}>{children}</span>}
    </div>
)
