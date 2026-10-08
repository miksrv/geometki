import React, { useEffect, useRef, useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import TabHeader from './TabHeader'

import styles from './styles.module.sass'

type TabType<T> = {
    label: string
    key: T
    /** Makes the tab a link to its own page */
    href?: string
}

export interface TabsProps<T> {
    className?: string
    tabs?: Array<TabType<T>>
    activeTab?: T
    onChangeTab?: (key?: T) => void
    'aria-label'?: string
}

/**
 * A bar of tabs on a card. Tabs that do not fit scroll horizontally (phones); the active
 * tab is scrolled into view and the cut-off edges fade out to show there is more.
 */
export const Tabs = <T extends string>({
    className,
    tabs,
    activeTab,
    onChangeTab,
    'aria-label': ariaLabel
}: TabsProps<T>) => {
    const listRef = useRef<HTMLDivElement>(null)
    const [overflow, setOverflow] = useState({ start: false, end: false })

    const updateOverflow = () => {
        const list = listRef.current
        if (!list) {
            return
        }

        const start = list.scrollLeft > 1
        const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1

        // Called on every scroll tick: keep the same state object unless an edge changed
        setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }

    useEffect(() => {
        const list = listRef.current
        const active = list?.querySelector<HTMLElement>(`.${styles.active}`)

        if (list && active && list.scrollWidth > list.clientWidth) {
            list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
        }

        updateOverflow()
    }, [activeTab])

    useEffect(() => {
        window.addEventListener('resize', updateOverflow)
        // The web font may load after mount and change the tab widths
        void document.fonts?.ready.then(updateOverflow)

        return () => window.removeEventListener('resize', updateOverflow)
    }, [])

    return (
        <nav
            className={cn(styles.tabs, overflow.start && styles.fadeStart, overflow.end && styles.fadeEnd, className)}
            aria-label={ariaLabel}
        >
            <div
                ref={listRef}
                className={styles.tabsHeader}
                onScroll={updateOverflow}
            >
                {tabs?.map(({ label, key, href }) => (
                    <TabHeader
                        key={key}
                        label={label}
                        href={href}
                        isActive={activeTab === key}
                        onClick={() => onChangeTab?.(key)}
                    />
                ))}
            </div>
        </nav>
    )
}
