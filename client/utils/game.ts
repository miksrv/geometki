import { ApiModel, ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'

import { buildSluggedUrl, parseSluggedId } from './slug'

type Translate = (key: string, options?: Record<string, unknown>) => string

export const GAME_HREF = '/game'

/** "How to play" (`/game/help`): the mechanics of the game in plain words */
export const GAME_HELP_HREF = '/game/help'

/** The quests, a section of their own: a quest is no part of the game's seasons */
export const QUESTS_HREF = '/quests'

/** The whole rating of the current season: the explorers' list in the season's order */
export const SEASON_RATING_HREF = '/users?sort=season'

/** The check-ins of the feed: its "Посещения" filter */
export const VISITS_FEED_HREF = '/activity?type=visits'

export const QUEST_CREATE_HREF = '/quests/create'

/** The page of a quest, `/quests/{id}-{slug}` */
export const questHref = (id: string, slug?: string | null): string => buildSluggedUrl(QUESTS_HREF, id, slug)

/** The editor of a quest: by the bare id */
export const questEditHref = (id: string): string => `${QUESTS_HREF}/${id}/edit`

/** The quest's id from the route param: the bare id or `{id}-{slug}`; empty for anything else */
export const parseQuestId = (param?: string | string[]): string => parseSluggedId(param)

/**
 * The page of a season, `/game/seasons/{id}-{slug}`. Only a past season has one: the current
 * season is the game page itself (its address redirects there), so pass `current` where it is known.
 */
export const seasonHref = (id: string, slug?: string | null, current?: boolean): string =>
    current ? GAME_HREF : buildSluggedUrl('/game/seasons', id, slug)

/** A new season: seasons are made by hand, by the administrators, on the site like a quest */
export const SEASON_CREATE_HREF = '/game/seasons/create'

/** The editor of a season: by the bare id; it works for any season, with a page of its own or not */
export const seasonEditHref = (id: string): string => `/game/seasons/${id}/edit`

/** The season's id from the route param: the bare id or `{id}-{slug}`; empty for anything else */
export const parseSeasonId = (param?: string | string[]): string => parseSluggedId(param)

/** The medal a closed season gives for a place in its table: 1, 2, 3 — the podium, the rest — the grey one */
export const medalForPlace = (place: number | null | undefined): ApiType.Game.MedalKind | null => {
    if (place == null || place < 1) {
        return null
    }

    return place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : 'participant'
}

/** "850 м", "1,2 км", "14 км": a quest's length — rounder than the map ruler's `formatDistance` */
export const formatLength = (metres: number, locale: string = 'ru'): string => {
    const isRu = locale.startsWith('ru')

    if (metres < 1000) {
        return `${Math.round(metres / 10) * 10} ${isRu ? 'м' : 'm'}`
    }

    const km = metres / 1000
    const text = km < 10 ? km.toFixed(1).replace(/\.0$/, '') : String(Math.round(km))

    return `${isRu ? text.replace('.', ',') : text} ${isRu ? 'км' : 'km'}`
}

/** Minutes a quest takes on foot: 4 km/h between the points and a few minutes at each one */
export const walkMinutes = (metres: number, points: number): number => {
    const minutes = (metres / 1000) * 15 + points * 4

    // To five minutes: the estimate is rough
    return Math.max(5, Math.round(minutes / 5) * 5)
}

/**
 * A walk to a point in a navigator, from wherever the walker is: Yandex Maps on the Russian
 * site, Google Maps on the English one. The point's own coordinates, nothing of the walker's.
 */
export const walkingDirectionsHref = (lat: number, lon: number, locale: string = 'ru'): string =>
    locale.startsWith('ru')
        ? `https://yandex.ru/maps/?rtext=~${lat},${lon}&rtt=pd`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`

/** The cover of every riddle quest: its places are the answers, so none of them is its picture */
export const QUEST_RIDDLE_COVER = '/images/quests/riddle-cover.webp'
/** The cover of every photo quest: its riddles are the covers of its places */
export const QUEST_PHOTO_COVER = '/images/quests/photo-cover.webp'

/** The modes whose places are their answers: hidden until found, on no map of the lists */
export const isSecretMode = (mode: ApiType.Game.QuestMode): boolean => mode === 'riddles' || mode === 'photos'

/**
 * The picture of a quest: the cover of its first point (`preview` for a small one), or the
 * drawn picture of the riddle or the photo quests. Undefined for a quest whose first point has no
 * cover.
 */
export const questCoverSrc = (
    quest: Pick<ApiType.Game.Quest, 'cover' | 'mode'>,
    preview: boolean = false
): string | undefined => {
    const cover = preview ? quest.cover?.preview : (quest.cover?.full ?? quest.cover?.preview)

    return cover
        ? `${IMG_HOST}${cover}`
        : quest.mode === 'riddles'
          ? QUEST_RIDDLE_COVER
          : quest.mode === 'photos'
            ? QUEST_PHOTO_COVER
            : undefined
}

type LatLon = { lat: number; lon: number }

/**
 * The box a map is fitted to: the points and the whole of the zones' circles. Undefined for
 * a single point without a zone (a map centres on it instead).
 */
export const questBounds = (
    points: LatLon[],
    zones: ApiType.Game.QuestZone[] = []
): [[number, number], [number, number]] | undefined => {
    if (points.length + zones.length === 0 || (points.length < 2 && zones.length === 0)) {
        return undefined
    }

    const corners = [
        ...points,
        ...zones.flatMap(({ lat, lon, radius }) => {
            const dLat = radius / 111320
            const dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180))

            return [
                { lat: lat - dLat, lon: lon - dLon },
                { lat: lat + dLat, lon: lon + dLon }
            ]
        })
    ]
    const lats = corners.map(({ lat }) => lat)
    const lons = corners.map(({ lon }) => lon)

    return [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
    ]
}

/** "40 минут", "1 ч 20 мин" */
export const formatWalkTime = (minutes: number, t: Translate): string =>
    minutes < 60
        ? t('game-time-minutes', { count: minutes })
        : minutes % 60
          ? t('game-time-hours-minutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
          : t('game-time-hours', { count: minutes / 60 })

/** A moment of the API ("2026-11-12 10:05:00") in ms; both ends of a span are read the same way */
const apiTime = (date: string): number => Date.parse(date.replace(' ', 'T'))

/**
 * How long a walk took, short: "2 д 3 ч", "3 ч 15 мин", "25 мин" — the two largest units, the
 * smaller one dropped when it is zero; at least a minute
 */
export const formatWalkDuration = (started: string, finished: string, t: Translate): string => {
    const total = Math.max(1, Math.round((apiTime(finished) - apiTime(started)) / 60000))
    const days = Math.floor(total / 1440)
    const hours = Math.floor((total % 1440) / 60)
    const minutes = total % 60

    if (days) {
        return hours ? t('game-duration-days-hours', { days, hours }) : t('game-duration-days', { days })
    }

    if (hours) {
        return minutes ? t('game-duration-hours-minutes', { hours, minutes }) : t('game-duration-hours', { hours })
    }

    return t('game-duration-minutes', { minutes })
}

/**
 * The points of a place at each step of the formula, for the public table:
 * `round(base × category × order)`.
 */
export const placePoints = (rules: ApiType.Game.Rules, category: ApiModel.Categories | undefined, position: number) => {
    const categoryFactor = (category && rules.categories[category]) || 1
    const orderFactor = rules.order.find(({ upTo }) => position <= upTo)?.factor ?? 1

    return Math.round(rules.base * categoryFactor * orderFactor)
}

/** The categories of the table of points, grouped by their factor, the dearest first */
export const categoriesByFactor = (
    rules: ApiType.Game.Rules
): Array<{ factor: number; categories: ApiModel.Categories[] }> => {
    const groups = new Map<number, ApiModel.Categories[]>()

    for (const category of Object.values(ApiModel.Categories)) {
        const factor = rules.categories[category] ?? 1

        groups.set(factor, [...(groups.get(factor) ?? []), category])
    }

    return Array.from(groups, ([factor, categories]) => ({ categories, factor })).sort((a, b) => b.factor - a.factor)
}

/** The scope of a rating as a query: everywhere without a location */
export const leadersScopeKey = (scope?: Pick<ApiType.Game.LeadersLocation, 'type' | 'id'>): string =>
    scope ? `${scope.type}-${scope.id}` : 'all'
