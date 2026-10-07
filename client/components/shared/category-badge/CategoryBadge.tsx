import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Image from 'next/image'

import { ApiModel } from '@/api'
import { categoryImage } from '@/utils/categories'

import { CATEGORY_COLORS } from './constants'

import styles from './styles.module.sass'

interface CategoryBadgeProps {
    category: ApiModel.Category
    className?: string
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className }) => {
    // Per-category colors (including the "unknown category" fallback) are a fixed
    // data palette, one hue per category, like the map heatmap/rating colors — the
    // hex value is also combined with an alpha suffix below, so it must stay hex.
    const color = CATEGORY_COLORS[category.name] ?? '#6B7280'

    return (
        <span
            className={cn(styles.categoryBadge, className)}
            style={{ backgroundColor: color + '50' }}
        >
            <Image
                src={categoryImage(category.name).src}
                alt={category.title}
                width={13}
                height={13}
            />
            {category.title}
        </span>
    )
}
