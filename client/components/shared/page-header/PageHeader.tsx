import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { BreadcrumbLink, Breadcrumbs } from '@/components/ui'

import styles from './styles.module.sass'

interface PageHeaderProps {
    title?: string
    /** One line under the title, secondary text; a node for a byline with links and an avatar */
    description?: React.ReactNode
    /** Path to the parent page — only nested pages have one (see DESIGN.md) */
    breadcrumbs?: BreadcrumbLink[]
    /** Element before the text, e.g. the avatar on a user's sub-page */
    leading?: React.ReactNode
    /** Page-level actions, `medium` buttons; wrap under the title on phones */
    actions?: React.ReactNode
    className?: string
}

/**
 * The page header: breadcrumbs above the h1, optional description, actions on the right.
 * Sits on the page background like the rest of the page chrome — never inside a Container.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    breadcrumbs,
    leading,
    actions,
    className
}) => (
    <div className={cn(styles.pageHeader, className)}>
        {leading && <div className={styles.leading}>{leading}</div>}

        <div className={styles.main}>
            <Breadcrumbs links={breadcrumbs} />
            {title && <h1 className={styles.title}>{title}</h1>}
            {description && <div className={styles.description}>{description}</div>}
        </div>

        {actions && <div className={styles.actions}>{actions}</div>}
    </div>
)
