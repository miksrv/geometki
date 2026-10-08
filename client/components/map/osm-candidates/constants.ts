import { useTranslation } from 'next-i18next/pages'

import type { CandidateGroup } from './utils'

/** Minimum map zoom for the layer: below it the area is too big */
export const OSM_CANDIDATES_MIN_ZOOM = 11

/** Wait until the map stops before asking for the area */
export const OSM_CANDIDATES_DEBOUNCE_MS = 500

/** While tiles of the area are being collected, check for the new candidates this often */
export const OSM_CANDIDATES_POLLING_MS = 30000

export const GROUP_COLORS: Record<CandidateGroup, string> = {
    explore: '#8a3ffc',
    known: '#2e9e44',
    onsite: '#2f6fd6',
    other: '#9a9a9a'
}

/** Legend order */
export const GROUPS: CandidateGroup[] = ['known', 'explore', 'other', 'onsite']

/** Shown by default: the rest is mostly noise for users */
export const DEFAULT_GROUPS: CandidateGroup[] = ['known', 'explore']

export const useGroupTitles = (): Record<CandidateGroup, string> => {
    const { t } = useTranslation()

    return {
        explore: t('osm-candidates_group-explore', { defaultValue: 'Неисследованные' }),
        known: t('osm-candidates_group-known', { defaultValue: 'Хорошо описанные' }),
        onsite: t('osm-candidates_group-onsite', { defaultValue: 'Уже на Геометках' }),
        other: t('osm-candidates_group-other', { defaultValue: 'Прочие объекты' })
    }
}

export const useGroupHints = (): Record<CandidateGroup, string> => {
    const { t } = useTranslation()

    return {
        explore: t('osm-candidates_hint-explore', {
            defaultValue: 'Интересный объект, о котором почти ничего не известно. Станьте первым, кто его опишет'
        }),
        known: t('osm-candidates_hint-known', {
            defaultValue: 'О месте много известно: есть статья, фото или охранный статус'
        }),
        onsite: t('osm-candidates_hint-onsite', { defaultValue: 'Эти места уже есть на Геометках' }),
        other: t('osm-candidates_hint-other', {
            defaultValue: 'Памятники, арт-объекты и другие места без подробностей'
        })
    }
}
