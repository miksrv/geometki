import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

interface TabHeaderProps {
    label?: string
    href?: string
    isActive?: boolean
    onClick?: () => void
}

/**
 * One tab: a link when the tab is a page (`href`), a button when it only switches state.
 */
const TabHeader: React.FC<TabHeaderProps> = ({ label, href, isActive, onClick }) => {
    const className = cn(styles.tabsHeaderItem, isActive && styles.active)

    return href ? (
        <Link
            href={href}
            className={className}
            aria-current={isActive ? 'page' : undefined}
            onClick={onClick}
        >
            {label}
        </Link>
    ) : (
        <button
            type={'button'}
            className={className}
            aria-pressed={isActive}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

export default TabHeader
