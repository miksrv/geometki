import React from 'react'
import { cn, Tooltip } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { categoryImage, getCategoryTitle } from '@/utils/categories'
import { buildCategoryHref, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

interface CategoryIconProps {
    category: ApiModel.Categories
    /** Side of the square icon in pixels */
    size?: number
    /** Link to the places of this category (default); off where the icon sits inside another control */
    link?: boolean
    className?: string
}

/**
 * The category of a place as its square icon, with the category name in a tooltip and as
 * the accessible name. Cards and the place page show the icon instead of a text label;
 * the name stays one hover (or the breadcrumbs) away.
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 20, link = true, className }) => {
    const { t } = useTranslation()
    const title = getCategoryTitle(t, category)

    const image = (
        <Image
            src={categoryImage(category).src}
            alt={link ? '' : title}
            width={size}
            height={size}
        />
    )

    if (!link) {
        return (
            <Tooltip content={title}>
                <span className={cn(styles.categoryIcon, className)}>{image}</span>
            </Tooltip>
        )
    }

    return (
        <Tooltip content={title}>
            <Link
                href={buildCategoryHref(category, getLandingFlags())}
                aria-label={title}
                className={cn(styles.categoryIcon, className)}
            >
                {image}
            </Link>
        </Tooltip>
    )
}
