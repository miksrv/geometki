import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'

import styles from './styles.module.sass'

interface TagsStatsProps {
    tags: ApiModel.Tag[]
}

export const TagsStats: React.FC<TagsStatsProps> = ({ tags }) => {
    const { t } = useTranslation()

    const totalTags = tags.length
    const totalPlaces = tags.reduce((sum, tag) => sum + (tag.count ?? 0), 0)

    return (
        <Container className={styles.tagsStats}>
            <div className={styles.chip}>
                <span className={styles.chipNumber}>{totalTags.toLocaleString()}</span>
                <span className={styles.chipLabel}>{t('tags-stat-total')}</span>
            </div>
            <div className={styles.chip}>
                <span className={styles.chipNumber}>{totalPlaces.toLocaleString()}</span>
                <span className={styles.chipLabel}>{t('tags-stat-places')}</span>
            </div>
        </Container>
    )
}
