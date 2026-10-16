import React from 'react'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { Chip } from '@/components/ui'

import styles from './styles.module.sass'

export interface AppliedFilter {
    key: string
    label: string
    icon?: React.ReactNode
    /** The list without this filter */
    href: string
}

interface AppliedFilterListProps {
    filters: AppliedFilter[]
    /** The list without any filter: "Сбросить всё" */
    resetHref: string
    /** The links change only the URL's query of this page (see `Chip`) */
    shallow?: boolean
}

/** What is applied, one removable chip per filter, and "Сбросить всё"; nothing — nothing */
export const AppliedFilterList: React.FC<AppliedFilterListProps> = ({ filters, resetHref, shallow }) => {
    const { t } = useTranslation()

    if (!filters.length) {
        return null
    }

    return (
        <div className={styles.applied}>
            {filters.map((filter) => (
                <Chip
                    key={filter.key}
                    size={'small'}
                    removable={true}
                    icon={filter.icon}
                    label={filter.label}
                    aria-label={t('filters-remove', 'Убрать фильтр: {{name}}', { name: filter.label })}
                    href={filter.href}
                    shallow={shallow}
                />
            ))}

            <Link
                href={resetHref}
                shallow={shallow}
                scroll={shallow ? false : undefined}
                className={styles.reset}
            >
                {t('filters-reset-all', 'Сбросить всё')}
            </Link>
        </div>
    )
}

/** The row of the applied filters with something else in it (a "Продолжить: …" link) */
export const AppliedFilterRow: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className={styles.applied}>{children}</div>
)
