import React, { useEffect, useRef, useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

/** The gap between two hexagons */
const GAP = 6

export interface AwardRowItem {
    key: string
    /** The hexagon at the height the row worked out */
    node: (size: number) => React.ReactNode
    /** Its picture alone, nothing to press: seen under "+N" when it is the first one not held */
    picture: (size: number) => React.ReactNode
}

interface AwardRowProps {
    items: AwardRowItem[]
    /** The smallest height of a hexagon: the row takes as many as fit and stretches them to its width */
    minSize: number
    /**
     * The last cell, always: the way to every award — "+N" with the number of the ones the row
     * does not hold, and the first of them (`under`) seen through it
     */
    more: (hidden: number, size: number, under?: React.ReactNode) => React.ReactNode
    'aria-label'?: string
    className?: string
}

/**
 * One row of hexagons from edge to edge of its block: as many as fit at `minSize`, then grown
 * so that the row is exactly as wide as the block (the counters above it in the profile's head).
 * The last cell is always the way to every award ("+N", the next award seen through it). The
 * row is never wider or taller than that.
 */
export const AwardRow: React.FC<AwardRowProps> = ({ items, minSize, more, className, ...props }) => {
    const ref = useRef<HTMLUListElement>(null)
    const [width, setWidth] = useState<number>(0)

    useEffect(() => {
        const list = ref.current

        if (!list) {
            return
        }

        const measure = () => setWidth(list.clientWidth)

        measure()

        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
        observer?.observe(list)

        return () => observer?.disconnect()
    }, [])

    // A hexagon is 0.866 of its height wide
    const columns = Math.max(1, Math.floor((width + GAP) / (minSize * 0.866 + GAP)))
    // Whole pixels for the pictures; a full row closes the last pixels with its gaps
    const size = width ? Math.floor((width - (columns - 1) * GAP) / columns / 0.866) : minSize

    // The last cell is the way to every award: the row holds one hexagon less
    const shown = items.slice(0, columns - 1)
    const hidden = items.length - shown.length
    const next = items[shown.length]
    const full = shown.length + 1 === columns

    return (
        <ul
            ref={ref}
            className={cn(styles.row, full && styles.full, className)}
            style={{ columnGap: GAP, height: size }}
            {...props}
        >
            {/* Nothing until the row is measured: the hexagons come at their size at once */}
            {!!width && (
                <>
                    {shown.map(({ key, node }) => (
                        <li
                            key={key}
                            className={styles.rowCell}
                            style={{ height: size, width: size * 0.866 }}
                        >
                            {node(size)}
                        </li>
                    ))}
                    <li
                        className={styles.rowCell}
                        style={{ height: size, width: size * 0.866 }}
                    >
                        {more(hidden, size, next?.picture(size))}
                    </li>
                </>
            )}
        </ul>
    )
}
