import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { categoryImage } from '@/functions/categories'

import styles from './styles.module.sass'

interface CategoriesListProps {
    categories?: ApiModel.Category[]
}

export const CategoriesList: React.FC<CategoriesListProps> = ({ categories }) => {
    const { t } = useTranslation('components.activity-list')

    return (
        <Container className={styles.categoriesList}>
            {categories?.map((category) => (
                <div
                    key={`category${category.name}`}
                    className={styles.categoryItem}
                >
                    <h3 className={styles.header}>
                        <Image
                            className={styles.categoryImage}
                            src={categoryImage(category.name).src}
                            alt={''}
                            width={15}
                            height={18}
                            style={{ marginRight: '4px' }}
                        />
                        <Link
                            href={`/places?category=${category.name}`}
                            title={`${category.title} - ${t('all-geotags-in-category')}`}
                        >
                            {category.title}
                        </Link>
                    </h3>
                    <p>{category.content}</p>
                    <p className={styles.description}>
                        <span>
                            {t('interesting-places-in-category', 'Интересных мест в категории')}:{' '}
                            <strong>{category.count ?? 0}</strong>
                        </span>
                        <Link
                            href={`/places?category=${category.name}`}
                            title={`${category.title} - ${t('all-geotags-in-category')}`}
                        >
                            {t('go-to-category', 'Перейти в категорию')}
                        </Link>
                    </p>
                </div>
            ))}
        </Container>
    )
}
