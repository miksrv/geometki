import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CATEGORY_COLORS } from '@/components/shared/category-badge/constants'
import { IMG_HOST } from '@/config/env'
import { categoryImage } from '@/utils/categories'

import styles from './styles.module.sass'

interface CategoriesListProps {
    categories?: ApiModel.Category[]
    topCategories?: ApiModel.TopCategory[]
}

export const CategoriesList: React.FC<CategoriesListProps> = ({ categories, topCategories }) => {
    const { t } = useTranslation()

    const topNames = new Set(topCategories?.map((c) => c.name) ?? [])
    const regularCategories = categories?.filter((c) => !topNames.has(c.name)) ?? []

    return (
        <div className={styles.categoriesPage}>
            {!!topCategories?.length && (
                <div className={styles.topSection}>
                    {topCategories.map((category, index) => {
                        const color = CATEGORY_COLORS[category.name] ?? '#6B7280'
                        const coverUrl = category.cover?.full ? `${IMG_HOST}${category.cover.full}` : undefined

                        return (
                            <div
                                key={category.name}
                                className={styles.topCard}
                            >
                                {coverUrl && (
                                    <Image
                                        src={coverUrl}
                                        alt={category.title}
                                        fill
                                        style={{ objectFit: 'cover' }}
                                        className={styles.topCardImage}
                                        sizes='(max-width: 768px) 100vw, 33vw'
                                    />
                                )}
                                <div className={styles.topCardOverlay} />

                                <div className={styles.topCardTopRow}>
                                    <span
                                        className={styles.topCardIcon}
                                        style={{ backgroundColor: color + '60' }}
                                    >
                                        <Image
                                            src={categoryImage(category.name).src}
                                            alt={category.title}
                                            width={28}
                                            height={28}
                                        />
                                    </span>
                                    <span className={styles.topBadge}>
                                        {'🔥 '}
                                        {t('category-top-label', 'Топ')} {index + 1}
                                    </span>
                                </div>

                                <div className={styles.topCardContent}>
                                    <Link
                                        href={`/places?category=${category.name}`}
                                        className={styles.topCardTitle}
                                        title={category.title}
                                    >
                                        {category.title}
                                    </Link>
                                    {category.content && (
                                        <p className={styles.topCardDescription}>{category.content}</p>
                                    )}
                                    <Link
                                        href={`/places?category=${category.name}`}
                                        className={styles.topCardButton}
                                        style={{ backgroundColor: color }}
                                    >
                                        {category.count?.toLocaleString()} {t('category-places-short', 'мест')}
                                        {' →'}
                                    </Link>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className={styles.categoriesGrid}>
                {regularCategories.map((category) => {
                    const color = CATEGORY_COLORS[category.name] ?? '#6B7280'

                    return (
                        <Container
                            key={`category${category.name}`}
                            className={styles.categoryCard}
                        >
                            <div className={styles.categoryCardHeader}>
                                <span
                                    className={styles.categoryIcon}
                                    style={{ backgroundColor: color + '30' }}
                                >
                                    <Image
                                        src={categoryImage(category.name).src}
                                        alt={category.title}
                                        width={24}
                                        height={24}
                                    />
                                </span>
                                <Link
                                    href={`/places?category=${category.name}`}
                                    className={styles.categoryTitle}
                                    title={category.title}
                                >
                                    {category.title}
                                </Link>
                            </div>
                            {category.content && <p className={styles.categoryDescription}>{category.content}</p>}
                            {category.count !== undefined && (
                                <Link
                                    href={`/places?category=${category.name}`}
                                    className={styles.categoryButton}
                                    style={{ backgroundColor: color }}
                                >
                                    {category.count.toLocaleString()} {t('category-places-short', 'мест')}
                                    {' →'}
                                </Link>
                            )}
                        </Container>
                    )
                })}
            </div>
        </div>
    )
}
