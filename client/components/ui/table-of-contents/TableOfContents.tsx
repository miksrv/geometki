import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useScrollSpy } from '@/hooks/useScrollSpy'

import styles from './styles.module.sass'

export interface TableOfContentsItem {
    /** The id of the section's heading */
    id: string
    title: string
}

export interface TableOfContentsProps {
    /** The sections in their page order */
    items: TableOfContentsItem[]
    /** The list's accessible name and visible caption, "Содержание" */
    label: string
    className?: string
}

/**
 * The contents of a page to read (DESIGN.md → Patterns → Contents of an article): the `##`
 * sections of its text as a list of links in a sticky side column; the section in view is
 * marked, a click scrolls smoothly to it and puts its anchor into the address without a history
 * entry, so the link can be shared. Nothing on phones: the text alone. Fewer than two sections
 * need no contents.
 */
export const TableOfContents: React.FC<TableOfContentsProps> = ({ items, label, className }) => {
    const { active, scrollTo } = useScrollSpy(items.map(({ id }) => id))

    if (items.length < 2) {
        return null
    }

    const handleClick = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (scrollTo(id)) {
            event.preventDefault()
            window.history.replaceState(window.history.state, '', `#${id}`)
        }
    }

    return (
        <nav
            className={cn(styles.contents, className)}
            aria-label={label}
        >
            <p className={styles.caption}>{label}</p>
            <ul>
                {items.map(({ id, title }) => (
                    <li key={id}>
                        <a
                            href={`#${id}`}
                            className={cn(active === id && styles.active)}
                            aria-current={active === id ? 'location' : undefined}
                            onClick={handleClick(id)}
                        >
                            {title}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
