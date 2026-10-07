import React from 'react'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface EmptyStateProps {
    title?: string
    description?: string
    /** Primary action under the text, e.g. a "create" button */
    action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
    const { t } = useTranslation()

    return (
        <div className={styles.component}>
            <Image
                className={styles.image}
                src={'/images/no-results.png'}
                alt={title ?? t('nothing-found')}
                width={220}
                height={220}
                priority={false}
            />
            <p className={styles.title}>{title ?? t('nothing-found')}</p>
            <p className={styles.description}>{description ?? t('nothing-found-description')}</p>
            {action && <div className={styles.action}>{action}</div>}
        </div>
    )
}
