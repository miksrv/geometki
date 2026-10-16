import React, { useEffect, useRef, useState } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface ScrollRailProps {
    /**
     * `chips` (default) — items of their own width, faded edges, small arrows (the category
     * rail); `cards` — three equal items in a row (one and a peek of the next on phones),
     * snapping to an item, big arrows at the height of the covers (place tiles)
     */
    variant?: 'chips' | 'cards'
    /** The accessible name of the row ("Категории") */
    'aria-label'?: string
    /** Labels of the arrow buttons */
    prevLabel?: string
    nextLabel?: string
    className?: string
    children?: React.ReactNode
}

/**
 * One row of items that scrolls sideways instead of wrapping: the native scroll — a swipe on
 * touch screens, a trackpad or Shift + wheel, Tab brings an item into view — and round arrow
 * buttons with a mouse, shown only while there is more to that side. The one horizontal
 * scroller of the site: chips and place tiles alike. A kit primitive candidate.
 */
export const ScrollRail: React.FC<ScrollRailProps> = ({
    variant = 'chips',
    'aria-label': ariaLabel,
    prevLabel = 'Back',
    nextLabel = 'Next',
    className,
    children
}) => {
    const listRef = useRef<HTMLDivElement>(null)
    const itemsCount = React.Children.count(children)
    const [overflow, setOverflow] = useState({ end: false, start: false })

    const updateOverflow = () => {
        const list = listRef.current
        if (!list) {
            return
        }

        const start = list.scrollLeft > 8
        const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 8

        // Called on every scroll tick: keep the same state object unless an edge changed
        setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { end, start }))
    }

    useEffect(() => {
        const list = listRef.current
        updateOverflow()

        // A resize, new items, or a hidden row shown (an inactive tab) change the edges
        if (list && typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateOverflow)
            observer.observe(list)
            Array.from(list.children).forEach((child) => observer.observe(child))

            return () => observer.disconnect()
        }

        window.addEventListener('resize', updateOverflow)

        return () => window.removeEventListener('resize', updateOverflow)
    }, [itemsCount])

    // A selected item (`aria-pressed` / `aria-current`) out of sight is brought into view once
    useEffect(() => {
        const list = listRef.current
        const selected = list?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current="true"]')

        if (list && selected && selected.offsetLeft + selected.offsetWidth > list.clientWidth) {
            list.scrollLeft = selected.offsetLeft - list.clientWidth / 3
        }

        updateOverflow()
    }, [])

    // Cards turn a whole screen of items, chips most of one: a few chips stay as a landmark
    const scrollBy = (direction: -1 | 1) => {
        const list = listRef.current
        const step = variant === 'cards' ? 1 : 0.7
        list?.scrollBy?.({ behavior: 'smooth', left: direction * list.clientWidth * step })
    }

    return (
        <div
            className={cn(
                styles.rail,
                styles[variant],
                overflow.start && styles.fadeStart,
                overflow.end && styles.fadeEnd,
                className
            )}
        >
            {overflow.start && (
                <button
                    type={'button'}
                    className={cn(styles.arrow, styles.prev)}
                    aria-label={prevLabel}
                    title={prevLabel}
                    tabIndex={-1}
                    onClick={() => scrollBy(-1)}
                >
                    <Icon name={'KeyboardLeft'} />
                </button>
            )}

            <div
                ref={listRef}
                role={'group'}
                aria-label={ariaLabel}
                className={styles.list}
                onScroll={updateOverflow}
            >
                {children}
            </div>

            {overflow.end && (
                <button
                    type={'button'}
                    className={cn(styles.arrow, styles.next)}
                    aria-label={nextLabel}
                    title={nextLabel}
                    tabIndex={-1}
                    onClick={() => scrollBy(1)}
                >
                    <Icon name={'KeyboardRight'} />
                </button>
            )}
        </div>
    )
}

/** A thin vertical rule between groups of items in a `ScrollRail` */
export const ScrollRailSeparator: React.FC = () => (
    <span
        className={styles.separator}
        aria-hidden={true}
    />
)
