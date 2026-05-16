import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { BreadcrumbsProps } from '@/components/ui'
import { Breadcrumbs } from '@/components/ui'

import styles from './styles.module.sass'

interface PageHeaderProps extends BreadcrumbsProps {
    title?: string
    description?: string
    backLink?: string
    children?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    backLink,
    children,
    ...breadcrumbsProps
}) => (
    <div className={styles.pageHeader}>
        {backLink && (
            <Button
                mode={'outline'}
                icon={'KeyboardLeft'}
                link={backLink}
            />
        )}

        <div className={styles.left}>
            {title && <h1 className={styles.title}>{title}</h1>}
            {description && <p className={styles.description}>{description}</p>}
            <Breadcrumbs {...breadcrumbsProps} />
        </div>

        {children && <div className={styles.right}>{children}</div>}
    </div>
)
