import type { TFunction } from 'i18next'

import { StaticImageData } from 'next/image'

import { ApiModel } from '@/api'
// The enum itself, not through the `@/api` barrel: this module must initialise even where a
// test mocks `@/api` without `ApiModel`
import { Categories } from '@/api/models/category'
import abandoned from '@/public/images/poi/abandoned.png'
import archeology from '@/public/images/poi/archeology.png'
import architecture from '@/public/images/poi/architecture.png'
import artwork from '@/public/images/poi/artwork.png'
import camping from '@/public/images/poi/camping.png'
import castle from '@/public/images/poi/castle.png'
import cave from '@/public/images/poi/cave.png'
import disaster from '@/public/images/poi/disaster.png'
import engineering from '@/public/images/poi/engineering.png'
import industrial from '@/public/images/poi/industrial.png'
import landscape from '@/public/images/poi/landscape.png'
import manor from '@/public/images/poi/manor.png'
import memorial from '@/public/images/poi/memorial.png'
import military from '@/public/images/poi/military.png'
import mountain from '@/public/images/poi/mountain.png'
import museum from '@/public/images/poi/museum.png'
import mystic from '@/public/images/poi/mystic.png'
import religious from '@/public/images/poi/religious.png'
import spring from '@/public/images/poi/spring.png'
import transport from '@/public/images/poi/transport.png'
import viewpoint from '@/public/images/poi/viewpoint.png'
import water from '@/public/images/poi/water.png'
import waterfall from '@/public/images/poi/waterfall.png'

/**
 * The category catalogue lives on the client: the keys (`ApiModel.Categories`, mirrored by the
 * server's `Config\Categories` whitelist), the icons and colours here and in
 * `components/shared/category-icon`, and every text in `public/locales/<lang>/common.json`
 * under `categoryCatalogue.<name>`: `title` (the short label for chips, filters and cards),
 * `landing` (the plural page name of `/places/{category}`, see features/20-location-seo-pages.md)
 * and `content` (the landing page's intro text). The API only ever carries the key and counts.
 * Adding a category: the enum, an icon, a colour, the three texts in both locales, and the key
 * in the server config.
 */

/** Every category key, in enum order — use `getCategoryOptions()` for a list sorted by name */
export const CATEGORY_NAMES: ApiModel.Categories[] = Object.values(Categories)

export const isCategoryName = (value: unknown): value is ApiModel.Categories =>
    typeof value === 'string' && (CATEGORY_NAMES as string[]).includes(value)

/**
 * Retired keys => the key that took their places (features/09-place-categories.md). Only for
 * the 301 of old `/places?category=` links, which have been indexed for years; the category
 * landing pages never went live under these keys.
 */
export const RENAMED_CATEGORIES: Readonly<Record<string, ApiModel.Categories>> = {
    animals: Categories.museum,
    bridge: Categories.engineering,
    construction: Categories.engineering,
    death: Categories.disaster,
    mine: Categories.industrial,
    monument: Categories.memorial,
    nature: Categories.landscape,
    radiation: Categories.disaster
}

/** The `t` of `useTranslation()`; only its (key, defaultValue) form is used here */
export type CategoryTranslate = TFunction | ((key: string, defaultValue?: string) => string)

const translate = (t: CategoryTranslate, key: string, defaultValue: string): string =>
    String((t as (key: string, defaultValue?: string) => unknown)(key, defaultValue) ?? defaultValue)

/** The short label: "Пещера (Грот)" — chips, filters, cards, breadcrumbs */
export const getCategoryTitle = (t: CategoryTranslate, name: ApiModel.Categories | string): string =>
    translate(t, `categoryCatalogue.${name}.title`, name)

/** The page name of the category landing: "Пещеры и гроты" — its h1 and title */
export const getCategoryLandingTitle = (t: CategoryTranslate, name: ApiModel.Categories | string): string =>
    translate(t, `categoryCatalogue.${name}.landing`, getCategoryTitle(t, name))

/** The landing page's intro text; '' when the locale has none */
export const getCategoryContent = (t: CategoryTranslate, name: ApiModel.Categories | string): string => {
    const content = translate(t, `categoryCatalogue.${name}.content`, '')

    return content === `categoryCatalogue.${name}.content` ? '' : content
}

export interface CategoryOption {
    key: ApiModel.Categories
    value: string
    image: StaticImageData
}

/** Select options for every category, sorted by the localized label */
export const getCategoryOptions = (t: CategoryTranslate): CategoryOption[] =>
    CATEGORY_NAMES.map((name) => ({ image: categoryImage(name), key: name, value: getCategoryTitle(t, name) })).sort(
        (a, b) => a.value.localeCompare(b.value)
    )

const CATEGORY_IMAGES: Record<ApiModel.Categories, StaticImageData> = {
    abandoned,
    archeology,
    architecture,
    artwork,
    camping,
    castle,
    cave,
    disaster,
    engineering,
    industrial,
    landscape,
    manor,
    memorial,
    military,
    mountain,
    museum,
    mystic,
    religious,
    spring,
    transport,
    viewpoint,
    water,
    waterfall
}

export const categoryImage = (category?: ApiModel.Categories): StaticImageData =>
    (category && CATEGORY_IMAGES[category]) || landscape
