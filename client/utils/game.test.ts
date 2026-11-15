import { ApiModel, ApiType } from '@/api'

import {
    categoriesByFactor,
    formatLength,
    formatWalkDuration,
    formatWalkTime,
    isSecretMode,
    leadersScopeKey,
    parseSeasonId,
    placePoints,
    QUEST_PHOTO_COVER,
    questBounds,
    questCoverSrc,
    seasonTitle,
    walkingDirectionsHref,
    walkMinutes
} from './game'

const t = (key: string, options?: Record<string, unknown>) => `${key}${options ? `:${JSON.stringify(options)}` : ''}`

const rules: ApiType.Game.Rules = {
    base: 10,
    categories: { cave: 2, manor: 1.5, memorial: 1 },
    graceDays: 7,
    order: [
        { factor: 2, upTo: 1 },
        { factor: 1.5, upTo: 5 }
    ],
    photoBonus: 5,
    radius: 300,
    radiuses: { memorial: 200, water: 3000 },
    spotBonus: 10
}

describe('utils/game', () => {
    it("leads a walker to a point in the navigator of the site's language", () => {
        expect(walkingDirectionsHref(51.77, 55.1)).toBe('https://yandex.ru/maps/?rtext=~51.77,55.1&rtt=pd')
        expect(walkingDirectionsHref(51.77, 55.1, 'en')).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=51.77,55.1&travelmode=walking'
        )
    })

    it('names a season warm or cold; a cold one spans two years', () => {
        expect(seasonTitle(t, { key: 'warm', year: 2027 })).toBe('game-season-warm:{"year":2027}')
        expect(seasonTitle(t, { key: 'cold', year: 2026 })).toBe('game-season-cold:{"year":"2026/27"}')
    })

    it('reads a season id', () => {
        expect(parseSeasonId('2026-cold')).toEqual({ key: 'cold', year: 2026 })
        expect(parseSeasonId('2026-fall')).toBeUndefined()
        expect(parseSeasonId('cold')).toBeUndefined()
    })

    it('formats the length of a quest roundly', () => {
        expect(formatLength(124, 'ru')).toBe('120 м')
        expect(formatLength(996, 'en')).toBe('1000 m')
        expect(formatLength(1440, 'ru')).toBe('1,4 км')
        expect(formatLength(1440, 'en')).toBe('1.4 km')
        expect(formatLength(7000, 'ru')).toBe('7 км')
        expect(formatLength(14600, 'ru')).toBe('15 км')
    })

    it('estimates the time on foot to five minutes', () => {
        // 1.5 km at 4 km/h and four minutes at each of 8 points
        expect(walkMinutes(1500, 8)).toBe(55)
        expect(walkMinutes(0, 0)).toBe(5)

        expect(formatWalkTime(40, t)).toBe('game-time-minutes:{"count":40}')
        expect(formatWalkTime(120, t)).toBe('game-time-hours:{"count":2}')
        expect(formatWalkTime(125, t)).toBe('game-time-hours-minutes:{"hours":2,"minutes":5}')
    })

    it('counts the points of a place as the server does: base × category × the bonus to the first ones', () => {
        expect(placePoints(rules, ApiModel.Categories.cave, 1)).toBe(40)
        expect(placePoints(rules, ApiModel.Categories.cave, 3)).toBe(30)
        expect(placePoints(rules, ApiModel.Categories.cave, 6)).toBe(20)
        expect(placePoints(rules, ApiModel.Categories.manor, 2)).toBe(23)
        // A category the table does not list is ×1
        expect(placePoints(rules, ApiModel.Categories.museum, 9)).toBe(10)
        expect(placePoints(rules, undefined, 1)).toBe(20)
    })

    it('groups the categories by their factor, the dearest first', () => {
        const groups = categoriesByFactor(rules)

        expect(groups.map(({ factor }) => factor)).toEqual([2, 1.5, 1])
        expect(groups[0].categories).toEqual([ApiModel.Categories.cave])
        expect(groups[2].categories).toContain(ApiModel.Categories.memorial)
        // Every category is in the table once
        expect(groups.flatMap(({ categories }) => categories)).toHaveLength(Object.values(ApiModel.Categories).length)
    })

    it('keys the scope of a rating', () => {
        expect(leadersScopeKey()).toBe('all')
        expect(leadersScopeKey({ id: 81, type: 'region' })).toBe('region-81')
    })

    it('fits a map to the points and the whole circles of the zones', () => {
        // One point and no zone: the map centres on it
        expect(questBounds([{ lat: 51.75, lon: 55.1 }])).toBeUndefined()

        const [[south, west], [north, east]] = questBounds([], [{ lat: 51.76, lon: 55.1, radius: 1113.2 }])!

        // 1113.2 m is 0.01° of latitude; a degree of longitude is shorter by the cosine
        expect(south).toBeCloseTo(51.75, 6)
        expect(north).toBeCloseTo(51.77, 6)
        expect(east - west).toBeCloseTo(0.02 / Math.cos((51.76 * Math.PI) / 180), 6)

        expect(questBounds([{ lat: 51.7, lon: 55 }], [{ lat: 51.76, lon: 55.1, radius: 1113.2 }])![0]).toEqual([
            51.7, 55
        ])
    })
})

describe('formatWalkDuration', () => {
    const tt = (key: string, opts?: Record<string, unknown>) => `${key}:${Object.values(opts ?? {}).join(',')}`

    it('gives the two largest units, dropping a zero one', () => {
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-12 12:20:00', tt)).toBe(
            'game-duration-days-hours:2,3'
        )
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-12 09:40:00', tt)).toBe('game-duration-days:2')
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-10 12:15:00', tt)).toBe(
            'game-duration-hours-minutes:3,15'
        )
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-10 11:00:00', tt)).toBe('game-duration-hours:2')
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-10 09:25:00', tt)).toBe('game-duration-minutes:25')
    })

    it('says at least a minute', () => {
        expect(formatWalkDuration('2026-11-10 09:00:00', '2026-11-10 09:00:10', tt)).toBe('game-duration-minutes:1')
    })
})

describe('photo quests', () => {
    it('keeps a photo quest as secret as a riddle quest', () => {
        expect(isSecretMode('photos')).toBe(true)
        expect(isSecretMode('riddles')).toBe(true)
        expect(isSecretMode('steps')).toBe(false)
    })

    it('gives a photo quest its own drawn cover', () => {
        expect(questCoverSrc({ mode: 'photos' })).toBe(QUEST_PHOTO_COVER)
    })
})
