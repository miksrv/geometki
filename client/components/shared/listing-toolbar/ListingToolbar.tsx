import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

interface ListingToolbarProps {
    className?: string
    children?: React.ReactNode
}

/**
 * The filter row directly above a list (DESIGN.md → Patterns → Listing toolbar): kit
 * controls grouped in `ListingToolbarGroup`s, on the page background. On wide screens every
 * control gets the same share of the row, however many there are; on phones the row scrolls
 * sideways at fixed control widths and the groups keep their controls together.
 */
export const ListingToolbar: React.FC<ListingToolbarProps> = ({ className, children }) => (
    <div
        className={cn(styles.component, className)}
        role={'toolbar'}
    >
        {children}
    </div>
)

/** A group of related controls in a `ListingToolbar`: the filters, the sorting */
export const ListingToolbarGroup: React.FC<ListingToolbarProps> = ({ className, children }) => (
    <div className={cn(styles.group, className)}>{children}</div>
)
