import React, { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Container } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Counter } from '@/components/ui'
import { categoryImage } from '@/utils/categories'

import styles from '../styles.module.sass'

interface CategoryControlProps {
    categories?: ApiModel.Categories[]
    onChangeCategories?: (categories?: ApiModel.Categories[]) => void
}

export const CategoryControl: React.FC<CategoryControlProps> = ({ categories, onChangeCategories }) => {
    const { t } = useTranslation('components.interactive-map.category-control')

    const layersContainerRef = useRef<HTMLUListElement>(null)
    const [open, setOpen] = useState<boolean>(false)

    const { data: categoryData } = API.useCategoriesGetListQuery()

    const allCategoriesCount = Object.values(ApiModel.Categories).length
    // The filter is on when some categories are switched off: the button shows how many are left
    const isFiltered = !!categories && categories.length !== allCategoriesCount

    const handleToggleOpen = () => {
        setOpen(!open)
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (layersContainerRef.current && !layersContainerRef.current.contains(event.target as Node)) {
            setOpen(false)
        }
    }

    const handleChangeCategory = (event: React.ChangeEvent<HTMLInputElement>) => {
        const category = event.target.id as ApiModel.Categories

        onChangeCategories?.(
            !event.target.checked
                ? (categories?.filter((item) => item !== category) ?? [])
                : [...(categories ?? []), category]
        )
    }

    const handleChangeAllCategories = () => {
        if (categories?.length === allCategoriesCount) {
            onChangeCategories?.([])
        } else {
            onChangeCategories?.(Object.values(ApiModel.Categories))
        }
    }

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return !open ? (
        <span className={styles.controlWithCounter}>
            <Button
                mode={'secondary'}
                icon={'Tune'}
                tooltip={t('map-category-filter', { defaultValue: 'Фильтр по категориям' })}
                onClick={handleToggleOpen}
            />
            {isFiltered && (
                <Counter
                    className={styles.controlCounter}
                    value={categories.length}
                    showZero={true}
                />
            )}
        </span>
    ) : (
        <Container
            className={styles.mapCategoryContainer}
            onMouseMove={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
        >
            <ul
                ref={layersContainerRef}
                className={styles.mapCategoryList}
            >
                <li className={styles.allCategories}>
                    <Checkbox
                        id={'allCategories'}
                        label={t('all-categories-of-geotags', {
                            defaultValue: 'Все категории геометок'
                        })}
                        checked={categories?.length === allCategoriesCount}
                        indeterminate={isFiltered && categories.length > 0}
                        onChange={handleChangeAllCategories}
                    />
                </li>

                {categoryData?.items?.map((item) => (
                    <li key={item.name}>
                        <Checkbox
                            id={item.name}
                            label={
                                <>
                                    <Image
                                        src={categoryImage(item.name).src}
                                        alt={''}
                                        width={18}
                                        height={18}
                                        style={{ marginRight: '4px' }}
                                    />
                                    {item.title}
                                </>
                            }
                            checked={categories?.includes(item.name)}
                            onChange={handleChangeCategory}
                        />
                    </li>
                ))}
            </ul>
        </Container>
    )
}
