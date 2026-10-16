import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { LastPlacesSearch } from './usePlacesFilterMemory'

import styles from './styles.module.sass'

interface ResumeSearchProps {
    lastSearch: LastPlacesSearch
}

/**
 * The last search of this browser as a dashed "Продолжить: …" link — remembered, never applied
 * by itself. It sits in the free part of the toolbar row, so it appears (read from storage after
 * mount) without moving anything.
 */
export const ResumeSearch: React.FC<ResumeSearchProps> = ({ lastSearch }) => {
    const { t } = useTranslation()

    return (
        <Link
            href={lastSearch.href}
            className={styles.resume}
        >
            <Icon name={'Time'} />
            {t('filters-resume', 'Продолжить:')} <b>{lastSearch.label}</b>
        </Link>
    )
}
