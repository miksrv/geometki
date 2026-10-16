import React from 'react'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { Chip, ScrollRail, ScrollRailSeparator } from '@/components/ui'
import { CATEGORY_GROUPS, categoryImage, getCategoryShortTitle } from '@/utils/categories'

interface CategoryRailProps {
    /** The categories on */
    selected: string[]
    /** The list's URL with these categories */
    hrefFor: (categories: string[]) => string
    /**
     * Facets: places per category in the result (a search). Given, the rail shows only the
     * categories with places, and those that are on, with their numbers; "Все" gets `total`
     */
    counts?: Record<string, number>
    total?: number
}

/**
 * The main filter, always in sight: "Все" and a chip per category with its icon, the
 * themed groups split by thin rules. A chip toggles its category, several can be on; every
 * chip is a link to the list it leads to.
 */
export const CategoryRail: React.FC<CategoryRailProps> = ({ selected, hrefFor, counts, total }) => {
    const { t } = useTranslation()

    const groups = CATEGORY_GROUPS.map((group) => ({
        ...group,
        categories: counts
            ? group.categories.filter((name) => counts[name] || selected.includes(name))
            : group.categories
    })).filter((group) => group.categories.length)

    return (
        <ScrollRail
            aria-label={t('categories')}
            prevLabel={t('scroll-back', 'Назад')}
            nextLabel={t('scroll-forward', 'Вперёд')}
        >
            <Chip
                label={t('filters-all-categories', 'Все')}
                count={counts ? total : undefined}
                selected={!selected.length}
                href={hrefFor([])}
            />

            {groups.map((group) => (
                <React.Fragment key={group.name}>
                    <ScrollRailSeparator />

                    {group.categories.map((name) => {
                        const on = selected.includes(name)

                        return (
                            <Chip
                                key={name}
                                label={getCategoryShortTitle(t, name)}
                                count={counts ? (counts[name] ?? 0) : undefined}
                                selected={on}
                                href={hrefFor(on ? selected.filter((item) => item !== name) : [...selected, name])}
                                icon={
                                    <Image
                                        src={categoryImage(name).src}
                                        alt={''}
                                        width={20}
                                        height={20}
                                    />
                                }
                            />
                        )
                    })}
                </React.Fragment>
            ))}
        </ScrollRail>
    )
}
