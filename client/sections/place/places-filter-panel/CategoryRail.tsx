import React from 'react'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { Chip, ScrollRail, ScrollRailSeparator } from '@/components/ui'
import { CATEGORY_GROUPS, categoryImage, getCategoryShortTitle } from '@/utils/categories'

import { PlacesFilterPatch } from './types'

interface CategoryRailProps {
    categories: string[]
    buildHref: (patch: PlacesFilterPatch) => string
}

/**
 * The main filter, always in sight: "Все" and a chip per category with its icon, the
 * themed groups split by thin rules. A chip toggles its category, several can be on; every
 * chip is a link to the listing it leads to.
 */
export const CategoryRail: React.FC<CategoryRailProps> = ({ categories, buildHref }) => {
    const { t } = useTranslation()

    return (
        <ScrollRail
            aria-label={t('categories')}
            prevLabel={t('scroll-back', 'Назад')}
            nextLabel={t('scroll-forward', 'Вперёд')}
        >
            <Chip
                label={t('filters-all-categories', 'Все')}
                selected={!categories.length}
                href={buildHref({ categories: [] })}
            />

            {CATEGORY_GROUPS.map((group) => (
                <React.Fragment key={group.name}>
                    <ScrollRailSeparator />

                    {group.categories.map((name) => {
                        const selected = categories.includes(name)

                        return (
                            <Chip
                                key={name}
                                label={getCategoryShortTitle(t, name)}
                                selected={selected}
                                href={buildHref({
                                    categories: selected
                                        ? categories.filter((item) => item !== name)
                                        : [...categories, name]
                                })}
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
