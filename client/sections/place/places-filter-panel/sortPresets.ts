import type { TFunction } from 'i18next'

import { ApiType } from '@/api'

export interface SortPreset {
    key: ApiType.SortFieldsType
    label: string
    caption?: string
}

/**
 * The sorts of the listing as ready answers ("Новые", "Лучший рейтинг"): each one has its
 * natural direction (most first, the distance — nearest first), so there is no order control. Old URLs with `?order=` still
 * work, the panel just never sets one. "Для вас" is for signed-in visitors only.
 */
export const getSortPresets = (t: TFunction, isAuth: boolean): SortPreset[] =>
    (
        [
            {
                caption: t('sort-preset-trending-caption', 'Что смотрят на этой неделе'),
                key: ApiType.SortFields.Trending,
                label: t('sort-preset-trending', 'Популярные сейчас')
            },
            isAuth
                ? {
                      caption: t('sort-preset-recommended-caption', 'По вашим интересам'),
                      key: ApiType.SortFields.Recommended,
                      label: t('sort-preset-recommended', 'Для вас')
                  }
                : null,
            {
                caption: t('sort-preset-distance-caption', 'Спросим, где вы'),
                key: ApiType.SortFields.Distance,
                label: t('sort-preset-distance', 'Ближе ко мне')
            },
            { key: ApiType.SortFields.Rating, label: t('sort-preset-rating', 'Лучший рейтинг') },
            {
                caption: t('sort-preset-views-caption', 'За всё время'),
                key: ApiType.SortFields.Views,
                label: t('sort-preset-views', 'Самые просматриваемые')
            },
            {
                caption: t('sort-preset-created-caption', 'Недавно добавленные'),
                key: ApiType.SortFields.Created,
                label: t('sort-preset-created', 'Новые')
            },
            {
                caption: t('sort-preset-comments-caption', 'Больше всего отзывов'),
                key: ApiType.SortFields.Comments,
                label: t('sort-preset-comments', 'Обсуждаемые')
            }
        ] as Array<SortPreset | null>
    ).filter((preset): preset is SortPreset => !!preset)

/** The label of any sort, a preset or one only an old URL can set (`views_week`, `updated_at`) */
export const getSortLabel = (t: TFunction, sort: ApiType.SortFieldsType): string =>
    getSortPresets(t, true).find(({ key }) => key === sort)?.label ?? t(`sort_${sort}`)

/** The `order` of a list request: the distance is always nearest first, the rest keep the URL's */
export const getRequestOrder = (sort: ApiType.SortFieldsType, order: ApiType.SortOrdersType): ApiType.SortOrdersType =>
    sort === ApiType.SortFields.Distance ? ApiType.SortOrders.ASC : order
