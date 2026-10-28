import type { TFunction } from 'i18next'
import type { LatLngBounds } from 'leaflet'

import { ApiType } from '@/api'

import { breakdownText, candidatesBounds, displayName, formatDistance, settlementText, wikipediaUrl } from './utils'

// Returns the default text with the {{placeholders}} filled in
const t = ((key: string, opts?: Record<string, unknown>) =>
    String(opts?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) =>
        String(opts?.[name] ?? '')
    )) as TFunction

const candidate = (overrides: Partial<ApiType.OsmCandidates.Candidate> = {}): ApiType.OsmCandidates.Candidate => ({
    breakdown: [],
    category: 'water',
    ele: null,
    heritage: null,
    id: 'abc0123456789',
    image: null,
    lat: 51.15,
    lon: 55.0,
    name: 'Паршино',
    osmId: 1,
    osmTag: 'natural=water',
    osmType: 'way',
    photos: [],
    place: null,
    score: 4,
    settlement: { distance: 2300, name: 'Такое', type: 'village' },
    size: null,
    source: 'osm',
    status: 'open',
    tier: 'known',
    typeTitle: 'Озеро',
    wikidata: null,
    wikipedia: null,
    ...overrides
})

describe('displayName', () => {
    it('adds the type to a bare natural name', () => {
        expect(displayName(t, candidate(), 'ru')).toBe('Озеро Паршино')
    })

    it('does not repeat the type already in the name', () => {
        expect(displayName(t, candidate({ name: 'озеро Паршино' }), 'ru')).toBe('озеро Паршино')
    })

    it('keeps the name of a non-natural object as is', () => {
        expect(
            displayName(t, candidate({ category: 'memorial', name: 'Жертвам репрессий', typeTitle: 'Монумент' }), 'ru')
        ).toBe('Жертвам репрессий')
    })

    it('names a nameless object by the nearest settlement', () => {
        expect(displayName(t, candidate({ name: null, typeTitle: 'Пещера' }), 'ru')).toBe('Пещера у с. Такое')
    })

    it('says "in" when the object is inside the settlement', () => {
        const inside = candidate({
            name: null,
            settlement: { distance: 0, name: 'Самара', type: 'city' },
            typeTitle: 'Шахта'
        })

        expect(displayName(t, inside, 'ru')).toBe('Шахта в г. Самара')
    })

    it('has no Russian settlement prefixes in English', () => {
        expect(displayName(t, candidate({ name: null, typeTitle: 'Cave' }), 'en')).toBe('Cave у Такое')
    })
})

describe('settlementText', () => {
    it('shows the distance from the settlement', () => {
        expect(settlementText(t, candidate(), 'ru')).toBe('2.3 км от с. Такое')
    })

    it('is empty without a settlement', () => {
        expect(settlementText(t, candidate({ settlement: null }), 'ru')).toBeUndefined()
    })
})

describe('formatDistance', () => {
    it('uses meters below a kilometer', () => {
        expect(formatDistance(t, 850)).toBe('850 м')
        expect(formatDistance(t, 1250)).toBe('1.3 км')
    })
})

describe('breakdownText', () => {
    it('describes the score signals', () => {
        expect(breakdownText(t, { code: 'sitelinks', points: 2, value: 5 })).toBe('Статьи на 5 языках')
        expect(breakdownText(t, { code: 'protected', points: 2 })).toBe('Охраняемый объект')
        expect(breakdownText(t, { code: 'lakeSize', points: 2, value: 2500 })).toBe('Размер 2.5 км')
    })
})

describe('wikipediaUrl', () => {
    it('builds the article link from the OSM wikipedia tag', () => {
        expect(wikipediaUrl('ru:Развал (озеро)')).toBe(
            'https://ru.wikipedia.org/wiki/%D0%A0%D0%B0%D0%B7%D0%B2%D0%B0%D0%BB_(%D0%BE%D0%B7%D0%B5%D1%80%D0%BE)'
        )
    })

    it('gives no link for a value that is not "lang:Title"', () => {
        expect(wikipediaUrl('https://ru.wikipedia.org/wiki/X')).toBeUndefined()
        expect(wikipediaUrl('evil.com/?:x')).toBeUndefined()
        expect(wikipediaUrl('Развал')).toBeUndefined()
    })
})

describe('candidatesBounds', () => {
    const bounds = (south: number, west: number, north: number, east: number): LatLngBounds =>
        ({ getEast: () => east, getNorth: () => north, getSouth: () => south, getWest: () => west }) as LatLngBounds

    it('widens the view to whole 0.1° tiles', () => {
        expect(candidatesBounds(bounds(51.123, 54.956, 51.381, 55.341))).toBe('51.1,54.9,51.4,55.4')
    })

    it('asks the same area for a small pan inside the same tiles', () => {
        expect(candidatesBounds(bounds(51.13, 54.96, 51.37, 55.33))).toBe(
            candidatesBounds(bounds(51.12, 54.94, 51.39, 55.38))
        )
    })

    it('keeps the 0.01° rounding when the tiles would go over the server limit', () => {
        // 1.32° × 0.71° fits, the tiles 1.5° × 0.8° do not
        expect(candidatesBounds(bounds(51.05, 54.95, 51.76, 56.27))).toBe('51.05,54.95,51.76,56.27')
    })
})
