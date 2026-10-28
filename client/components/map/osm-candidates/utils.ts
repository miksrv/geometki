import type { TFunction } from 'i18next'
import type { LatLngBounds } from 'leaflet'

import { ApiType } from '@/api'

import { roundBoundsOutwards } from '../bounds'

import { OSM_CANDIDATES_MAX_AREA, OSM_TILES_PER_DEGREE } from './constants'

type Candidate = ApiType.OsmCandidates.Candidate

/** Natural objects: the bare name ("Паршино") does not tell what it is */
const NATURAL_CATEGORIES = ['water', 'mountain', 'cave', 'spring', 'waterfall', 'landscape', 'viewpoint']

const SETTLEMENT_PREFIX: Record<string, string> = { city: 'г.', hamlet: 'д.', town: 'г.', village: 'с.' }

/**
 * The area to ask for: widened to whole tiles, so that panning inside the same tiles asks the same
 * URL and is answered from the RTK cache. When the tiles would go over the server limit, it is
 * rounded to 0.01° as before, so that a view near the limit is not refused as `tooLarge`
 */
export const candidatesBounds = (bounds: LatLngBounds): string => {
    const tiles = roundBoundsOutwards(bounds, OSM_TILES_PER_DEGREE)
    const [south, west, north, east] = tiles
    // A hair below the limit: the server multiplies the same floats and must not land just above it
    const fits = (north - south) * (east - west) < OSM_CANDIDATES_MAX_AREA - 1e-6

    return (fits ? tiles : roundBoundsOutwards(bounds)).join(',')
}

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

/** Human text of one score signal shown to a visitor (the others are not shown, see the popup) */
export const breakdownText = (t: TFunction, item: ApiType.OsmCandidates.BreakdownItem): string => {
    switch (item.code) {
        case 'wiki':
            return t('osm-candidates_score-wiki', { defaultValue: 'Есть статья в Википедии' })
        case 'nearbyWiki':
            return t('osm-candidates_score-nearby-wiki', { defaultValue: 'Найдена статья в Википедии' })
        case 'sitelinks':
            return t('osm-candidates_score-sitelinks', {
                defaultValue: 'Статьи на {{value}} языках',
                value: item.value
            })
        case 'protected':
            return t('osm-candidates_score-protected', { defaultValue: 'Охраняемый объект' })
        case 'salt':
            return t('osm-candidates_score-salt', { defaultValue: 'Солёное озеро' })
        case 'lakeSize':
            return t('osm-candidates_score-lake-size', {
                defaultValue: 'Размер {{value}}',
                value: formatDistance(t, Number(item.value))
            })
        case 'type':
        case 'description':
        case 'website':
        case 'photo':
        case 'names':
        case 'contour':
        case 'dimensions':
        case 'noName':
        case 'private':
        default:
            return item.code
    }
}

/** Article link from the OSM "lang:Title" value; anything else (a pasted URL, a typo) gives no link */
export const wikipediaUrl = (value: string): string | undefined => {
    const match = /^([a-z][a-z-]{1,11}):([^/\s].*)$/.exec(value.trim())

    return match
        ? `https://${match[1]}.wikipedia.org/wiki/${encodeURIComponent(match[2].trim().replace(/ /g, '_'))}`
        : undefined
}
