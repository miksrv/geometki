import type { TFunction } from 'i18next'

import { ApiType } from '@/api'

type Candidate = ApiType.OsmCandidates.Candidate

/** Legend groups: the three tiers, and the objects that are already on Geometki (admins only) */
export type CandidateGroup = ApiType.OsmCandidates.Tier | 'onsite'

/** Natural objects: the bare name ("Паршино") does not tell what it is */
const NATURAL_CATEGORIES = ['water', 'mountain', 'cave', 'spring', 'waterfall', 'landscape', 'viewpoint']

const SETTLEMENT_PREFIX: Record<string, string> = { city: 'г.', hamlet: 'д.', town: 'г.', village: 'с.' }

export const candidateGroup = (candidate: Candidate): CandidateGroup =>
    candidate.status === 'open' ? candidate.tier : 'onsite'

export const formatDistance = (t: TFunction, meters: number): string =>
    meters >= 1000
        ? t('osm-candidates_distance-km', { defaultValue: '{{value}} км', value: (meters / 1000).toFixed(1) })
        : t('osm-candidates_distance-m', { defaultValue: '{{value}} м', value: meters })

/** "г. Самара" in Russian, just "Samara" in English */
export const settlementName = (candidate: Candidate, locale: string): string => {
    const settlement = candidate.settlement

    if (!settlement) {
        return ''
    }

    const prefix = locale === 'ru' ? SETTLEMENT_PREFIX[settlement.type] : undefined

    return prefix ? `${prefix} ${settlement.name}` : settlement.name
}

/** "в г. Самара" or "2.3 км от с. Такое-то" */
export const settlementText = (t: TFunction, candidate: Candidate, locale: string): string | undefined => {
    if (!candidate.settlement) {
        return undefined
    }

    const place = settlementName(candidate, locale)

    return candidate.settlement.distance === 0
        ? t('osm-candidates_settlement-inside', { defaultValue: 'в {{place}}', place })
        : t('osm-candidates_settlement-distance', {
              defaultValue: '{{distance}} от {{place}}',
              distance: formatDistance(t, candidate.settlement.distance),
              place
          })
}

/**
 * The name to show: nameless objects get at least an address ("Пещера у с. Такое-то"),
 * natural ones get their type ("Паршино" → "Озеро Паршино", but "озеро Паршино" stays as it is)
 */
export const displayName = (t: TFunction, candidate: Candidate, locale: string): string => {
    if (!candidate.name) {
        if (!candidate.settlement) {
            return candidate.typeTitle
        }

        const place = settlementName(candidate, locale)

        return candidate.settlement.distance === 0
            ? t('osm-candidates_unnamed-inside', {
                  defaultValue: '{{type}} в {{place}}',
                  place,
                  type: candidate.typeTitle
              })
            : t('osm-candidates_unnamed-near', {
                  defaultValue: '{{type}} у {{place}}',
                  place,
                  type: candidate.typeTitle
              })
    }

    const typeStem = candidate.typeTitle.toLowerCase().slice(0, 4)

    return NATURAL_CATEGORIES.includes(candidate.category ?? '') && !candidate.name.toLowerCase().includes(typeStem)
        ? `${candidate.typeTitle} ${candidate.name}`
        : candidate.name
}

/** Human text of one line of the score breakdown */
export const breakdownText = (
    t: TFunction,
    item: ApiType.OsmCandidates.BreakdownItem,
    candidate: Candidate
): string => {
    switch (item.code) {
        case 'type':
            return t('osm-candidates_score-type', { defaultValue: 'Тип: {{value}}', value: candidate.typeTitle })
        case 'wiki':
            return t('osm-candidates_score-wiki', { defaultValue: 'Есть статья в Википедии' })
        case 'nearbyWiki':
            return t('osm-candidates_score-nearby-wiki', {
                defaultValue: 'Найдена статья в Википедии: {{value}}',
                value: item.value
            })
        case 'sitelinks':
            return t('osm-candidates_score-sitelinks', {
                defaultValue: 'Статьи на {{value}} языках',
                value: item.value
            })
        case 'protected':
            return t('osm-candidates_score-protected', { defaultValue: 'Охраняемый объект' })
        case 'photo':
            return t('osm-candidates_score-photo', { defaultValue: 'Есть фото' })
        case 'description':
            return t('osm-candidates_score-description', { defaultValue: 'Есть описание' })
        case 'website':
            return t('osm-candidates_score-website', { defaultValue: 'Есть сайт' })
        case 'names':
            return t('osm-candidates_score-names', { defaultValue: 'Названия на {{value}} языках', value: item.value })
        case 'contour':
            return t('osm-candidates_score-contour', { defaultValue: 'Нарисован контуром на карте' })
        case 'salt':
            return t('osm-candidates_score-salt', { defaultValue: 'Солёное озеро' })
        case 'lakeSize':
            return t('osm-candidates_score-lake-size', {
                defaultValue: 'Размер {{value}}',
                value: formatDistance(t, Number(item.value))
            })
        case 'dimensions':
            return t('osm-candidates_score-dimensions', { defaultValue: 'Известны размеры' })
        case 'noName':
            return t('osm-candidates_score-no-name', { defaultValue: 'Нет названия' })
        case 'private':
            return t('osm-candidates_score-private', { defaultValue: 'Закрытая территория' })
        default:
            return item.code
    }
}

export const formatPoints = (points: number): string => (points > 0 ? `+${points}` : String(points))

/** Article link from the OSM "lang:Title" value; anything else (a pasted URL, a typo) gives no link */
export const wikipediaUrl = (value: string): string | undefined => {
    const match = /^([a-z][a-z-]{1,11}):([^/\s].*)$/.exec(value.trim())

    return match
        ? `https://${match[1]}.wikipedia.org/wiki/${encodeURIComponent(match[2].trim().replace(/ /g, '_'))}`
        : undefined
}
