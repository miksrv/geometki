import type { TFunction } from 'i18next'

import { StaticImageData } from 'next/image'

import { ApiModel } from '@/api'
// The enum itself, not through the `@/api` barrel: this module must initialise even where a
// test mocks `@/api` without `ApiModel`
import { Categories } from '@/api/models/category'
import abandoned from '@/public/images/poi/abandoned.png'
import animals from '@/public/images/poi/animals.png'
import archeology from '@/public/images/poi/archeology.png'
import bridge from '@/public/images/poi/bridge.png'
import camping from '@/public/images/poi/camping.png'
import castle from '@/public/images/poi/castle.png'
import cave from '@/public/images/poi/cave.png'
import construction from '@/public/images/poi/construction.png'
import death from '@/public/images/poi/death.png'
import manor from '@/public/images/poi/manor.png'
import memorial from '@/public/images/poi/memorial.png'
import military from '@/public/images/poi/military.png'
import mine from '@/public/images/poi/mine.png'
import monument from '@/public/images/poi/monument.png'
import mountain from '@/public/images/poi/mountain.png'
import museum from '@/public/images/poi/museum.png'
import nature from '@/public/images/poi/nature.png'
import radiation from '@/public/images/poi/radiation.png'
import religious from '@/public/images/poi/religious.png'
import spring from '@/public/images/poi/spring.png'
import transport from '@/public/images/poi/transport.png'
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

export const categoryImage = (category?: ApiModel.Categories): StaticImageData => {
    switch (category) {
        case ApiModel.Categories.animals:
            return animals

        case ApiModel.Categories.death:
            return death

        case ApiModel.Categories.radiation:
            return radiation

        case ApiModel.Categories.bridge:
            return bridge

        case ApiModel.Categories.military:
            return military

        case ApiModel.Categories.transport:
            return transport

        case ApiModel.Categories.abandoned:
            return abandoned

        case ApiModel.Categories.mine:
            return mine

        case ApiModel.Categories.construction:
            return construction

        case ApiModel.Categories.memorial:
            return memorial

        case ApiModel.Categories.monument:
            return monument

        case ApiModel.Categories.museum:
            return museum

        case ApiModel.Categories.castle:
            return castle

        case ApiModel.Categories.manor:
            return manor

        case ApiModel.Categories.religious:
            return religious

        case ApiModel.Categories.archeology:
            return archeology

        case ApiModel.Categories.cave:
            return cave

        case ApiModel.Categories.waterfall:
            return waterfall

        case ApiModel.Categories.spring:
            return spring

        case ApiModel.Categories.nature:
            return nature

        case ApiModel.Categories.water:
            return water

        case ApiModel.Categories.mountain:
            return mountain

        case ApiModel.Categories.camping:
            return camping

        case undefined: {
            throw new Error('Not implemented yet: undefined case')
        }

        default:
            return nature
    }
}
