import React, { useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Section } from '@/components/shared'
import { categoryImage, getCategoryShortTitle } from '@/utils/categories'
import { buildCategoryHref, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Two rows of six on a desktop; the rest is one click away */
const COLLAPSED_COUNT = 12
/** Three rows of two on a phone */
const COLLAPSED_COUNT_MOBILE = 6

interface HomeCategoriesProps {
    categories?: ApiType.Stats.CategoryCount[]
}

/**
 * A guest's way into the content by theme: a tile for every category with places, the
 * fullest first, each a link to its list (or its landing once NEXT_PUBLIC_LANDING_CATEGORIES
 * is on), so the home page also links every category page.
 */
export const HomeCategories: React.FC<HomeCategoriesProps> = ({ categories }) => {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState<boolean>(false)

    if (!categories?.length) {
        return null
    }

    const flags = getLandingFlags()

    const hidden = categories.length - COLLAPSED_COUNT_MOBILE

    return (
        <Section
            title={t('home-categories-title')}
            action={
                hidden > 0 && (
                    <Button
                        // Six are shown on a phone, twelve on a desktop: nothing to expand there
                        className={cn(categories.length <= COLLAPSED_COUNT && styles.mobileOnly)}
                        mode={'link'}
                        label={
                            expanded
                                ? t('home-categories-collapse')
                                : t('home-categories-all', { count: categories.length })
                        }
                        onClick={() => setExpanded(!expanded)}
                    />
                )
            }
        >
            <ul className={styles.grid}>
                {categories.map(({ name, count }, index) => (
                    <li
                        key={name}
                        // Hidden, not unrendered: the links stay in the page for search engines
                        className={cn(
                            !expanded && index >= COLLAPSED_COUNT && styles.hidden,
                            !expanded && index >= COLLAPSED_COUNT_MOBILE && styles.hiddenMobile
                        )}
                    >
                        <Link
                            href={buildCategoryHref(name, flags)}
                            className={styles.tile}
                        >
                            <Image
                                src={categoryImage(name)}
                                alt={''}
                                width={36}
                                height={36}
                            />
                            <span className={styles.name}>{getCategoryShortTitle(t, name)}</span>
                            <span className={styles.count}>{t('home-places-count', { count })}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </Section>
    )
}
