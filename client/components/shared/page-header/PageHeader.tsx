import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { BreadcrumbLink, Breadcrumbs, ExpandableText } from '@/components/ui'

import styles from './styles.module.sass'

interface PageHeaderProps {
    title?: string
    /** The meta line under the title, secondary text: a count, a byline with links and an avatar */
    description?: React.ReactNode
    /** The lede: a few sentences introducing the page, clamped behind "Подробнее" (see DESIGN.md) */
    lede?: string
    /** Path to the parent page — only nested pages have one (see DESIGN.md) */
    breadcrumbs?: BreadcrumbLink[]
    /** Element before the text, e.g. the avatar on a user's sub-page */
    leading?: React.ReactNode
    /** Page-level actions: `small` buttons on the title line, right-aligned; under the title on phones */
    actions?: React.ReactNode
    /** A block beside the text (the map preview of a location landing); stacks under it on phones */
    aside?: React.ReactNode
    className?: string
}

/**
 * The page header: breadcrumbs above the h1, actions on the h1's own line, then the meta line
 * and the lede. Sits on the page background like the rest of the page chrome — never inside
 * a Container.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    lede,
    breadcrumbs,
    leading,
    actions,
    aside,
    className
}) => {
    const { t } = useTranslation()

    return (
        <div className={cn(styles.pageHeader, !!aside && styles.withAside, className)}>
            {leading && <div className={styles.leading}>{leading}</div>}

            <div className={styles.main}>
                <Breadcrumbs links={breadcrumbs} />
                {(title || actions) && (
                    <div className={styles.titleRow}>
                        {title && <h1 className={styles.title}>{title}</h1>}
                        {actions && <div className={styles.actions}>{actions}</div>}
                    </div>
                )}
                {description && <div className={styles.description}>{description}</div>}
                {lede && (
                    <ExpandableText
                        className={styles.lede}
                        text={lede}
                        moreLabel={t('read-more', 'Подробнее')}
                    />
                )}
            </div>

            {aside && <div className={styles.aside}>{aside}</div>}
        </div>
    )
}
