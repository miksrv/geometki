import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CATEGORY_COLORS } from '@/components/shared/category-badge/constants'
import { categoryImage } from '@/utils/categories'

import styles from './styles.module.sass'

interface PopularCategoriesProps {
    categories?: ApiModel.TopCategory[]
}

export const PopularCategories: React.FC<PopularCategoriesProps> = ({ categories }) => {
    const { t } = useTranslation()

    if (!categories?.length) {
        return null
    }

    return (
        <Container
            title={t('popular-categories-week', 'Популярные категории недели')}
            action={
                <Link
                    href={'/categories'}
                    title={t('nav-categories')}
                >
                    {t('all-categories', 'Все категории')}
                </Link>
            }
        >
            <div className={styles.grid}>
                {categories.map((category) => {
                    const color = CATEGORY_COLORS[category.name] ?? '#6B7280'

                    return (
                        <Link
                            key={category.name}
                            href={`/places?category=${category.name}`}
                            className={styles.card}
                            title={category.title}
                            style={{
                                backgroundColor: color + '10',
                                border: `.5px solid ${color}50`
                            }}
                        >
                            <Image
                                src={categoryImage(category.name).src}
                                alt={category.title}
                                width={42}
                                height={42}
                            />
                            <span className={styles.title}>{category.title}</span>
                            {category.count !== undefined && (
                                <span className={styles.count}>{category.count.toLocaleString()}</span>
                            )}
                        </Link>
                    )
                })}
            </div>
        </Container>
    )
}
