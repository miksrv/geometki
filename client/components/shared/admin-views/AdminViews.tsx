import React from 'react'

import { Chip } from '@/components/ui'

import styles from './styles.module.sass'

export interface AdminView<T extends string> {
    /** The value of the filter this view sets; `undefined` is "everything" */
    key: T | undefined
    label: string
    /** How many rows the view holds; none while it is not known */
    count?: number
}

export interface AdminViewsProps<T extends string> {
    views: Array<AdminView<T>>
    /** The view that is on; none when the list is narrowed by something the views do not cover */
    active?: T
    /** No view is pressed, not even "everything": another filter holds the same field */
    none?: boolean
    onChange: (key: T | undefined) => void
    /** What the views split the list by, for screen readers: "Статус" */
    'aria-label': string
}

/**
 * The saved views of an admin list (ADMIN-UI.md → Lists): the few ways the list is looked at
 * most — all, in the queue, with an error — as a row of toggle chips with their counts, above
 * the filters. One is always on; the rest of the filters narrow the view that is.
 */
export const AdminViews = <T extends string>({
    views,
    active,
    none,
    onChange,
    'aria-label': ariaLabel
}: AdminViewsProps<T>) => (
    <div
        className={styles.views}
        role={'group'}
        aria-label={ariaLabel}
    >
        {views.map(({ key, label, count }) => (
            <Chip
                key={key ?? 'all'}
                size={'small'}
                label={label}
                count={count}
                selected={!none && active === key}
                onClick={() => onChange(key)}
            />
        ))}
    </div>
)
