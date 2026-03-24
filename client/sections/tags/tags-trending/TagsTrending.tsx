import React, { useMemo } from 'react'
import { Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'

import styles from './styles.module.sass'

const TRENDING_COUNT = 8
const HEAT_DOTS = 4

interface TagsTrendingProps {
    tags: ApiModel.Tag[]
}

export const TagsTrending: React.FC<TagsTrendingProps> = ({ tags }) => {
    const { t } = useTranslation()

    const trendingTags = useMemo(
        () => [...tags].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, TRENDING_COUNT),
        [tags]
    )

    const maxCount = trendingTags[0]?.count ?? 1

    return (
        <Container title={t('tags-trending')}>
            <div className={styles.strip}>
                {trendingTags.map((tag) => {
                    const filledDots = Math.round(((tag.count ?? 0) / maxCount) * HEAT_DOTS)
                    return (
                        <Link
                            key={tag.id ?? tag.title}
                            href={`/places?tag=${tag.title}`}
                            title={tag.title}
                            className={styles.card}
                        >
                            <span className={styles.cardTitle}>{tag.title}</span>
                            <span className={styles.cardCount}>{tag.count}</span>
                            <span
                                className={styles.heatBar}
                                aria-hidden='true'
                            >
                                {Array.from({ length: HEAT_DOTS }, (_, i) => (
                                    <span
                                        key={i}
                                        className={i < filledDots ? styles.dotFilled : styles.dotEmpty}
                                    >
                                        {i < filledDots ? '●' : '○'}
                                    </span>
                                ))}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </Container>
    )
}
