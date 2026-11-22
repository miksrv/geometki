import React, { useEffect, useRef, useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

/** The gap between two hexagons, the same along every edge */
const GAP = 6

export interface AwardHoneycombItem {
    key: string
    /** The hexagon at the height the honeycomb worked out from its width */
    node: (size: number) => React.ReactNode
}

interface AwardHoneycombProps {
    items: AwardHoneycombItem[]
    /** Hexagons in a row: their size follows the width of the block */
    columns: number
    'aria-label'?: string
    className?: string
}

/**
 * Hexagons stacked as honeycomb, as the badges of Ingress: every other row is moved by half a
 * hexagon and the rows go into each other by a quarter of the height, so the slanted edges of
 * neighbours keep the same gap as the upright ones — a piece of the hexagons of the map. A fixed
 * number of columns: the hexagons grow so that the rows, with the half-hexagon shift, fill the
 * width of the block.
 */
export const AwardHoneycomb: React.FC<AwardHoneycombProps> = ({ items, columns, className, ...props }) => {
    const ref = useRef<HTMLUListElement>(null)
    const [blockWidth, setBlockWidth] = useState<number>(0)

    useEffect(() => {
        const list = ref.current

        if (!list) {
            return
        }

        // A block not laid out yet (hidden) keeps its width
        const measure = () => {
            if (list.clientWidth > 0) {
                setBlockWidth(list.clientWidth)
            }
        }

        measure()

        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
        observer?.observe(list)

        return () => observer?.disconnect()
    }, [])

    // The rows and half a hexagon of the shift fill the width; whole pixels for the pictures
    const pitchX = (blockWidth + GAP) / (columns + 0.5)
    const size = Math.floor((pitchX - GAP) / 0.866)
    const width = Math.round(size * 0.866)
    const step = width + GAP
    // A quarter of a hexagon goes into the row above; the gap along a slanted edge is GAP too
    const pitchY = size * 0.75 + GAP * 0.866

    const rows = Math.ceil(items.length / columns)
    // One row alone needs no room for the shift
    const shifted = rows > 1
    // What is left of the rounding goes to both sides
    const used = Math.min(items.length, columns) * step - GAP + (shifted ? step / 2 : 0)
    const offset = Math.max(0, (blockWidth - used) / 2)

    return (
        <ul
            ref={ref}
            className={cn(styles.honeycomb, className)}
            style={{ height: blockWidth && rows ? size + (rows - 1) * pitchY : 0 }}
            {...props}
        >
            {/* Nothing until the block is measured: the hexagons come at their size at once */}
            {!!blockWidth &&
                items.map(({ key, node }, index) => {
                    const row = Math.floor(index / columns)
                    const column = index % columns

                    return (
                        <li
                            key={key}
                            className={styles.cell}
                            style={{
                                height: size,
                                left: offset + column * step + (shifted && row % 2 ? step / 2 : 0),
                                top: row * pitchY,
                                width
                            }}
                        >
                            {node(size)}
                        </li>
                    )
                })}
        </ul>
    )
}
