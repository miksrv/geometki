import { ApiType } from '@/api'

import { filterAchievements } from './filterAchievements'

const make = (id: string, extra: Partial<ApiType.Achievements.AchievementAdmin>) =>
    ({
        group_slug: id,
        id,
        title: id,
        title_en: id,
        title_ru: id,
        type: 'base',
        ...extra
    }) as ApiType.Achievements.AchievementAdmin

const items = [
    make('writer', { title_ru: 'Автор' }),
    make('walker', { title_ru: 'Ходок' }),
    make('winter', { type: 'seasonal', title_ru: 'Зимний' })
]

describe('filterAchievements', () => {
    it('returns everything without a filter', () => {
        expect(filterAchievements(items, {})).toHaveLength(3)
    })

    it('narrows by type', () => {
        expect(filterAchievements(items, { type: 'seasonal' })?.map((item) => item.id)).toEqual(['winter'])
    })

    it('searches the titles in both languages, ignoring case and spaces around', () => {
        expect(filterAchievements(items, { query: ' ЗИМ ' })?.map((item) => item.id)).toEqual(['winter'])
        expect(filterAchievements(items, { query: 'walk' })?.map((item) => item.id)).toEqual(['walker'])
    })

    it('combines the filters and passes a not loaded list through', () => {
        expect(filterAchievements(items, { query: 'wal', type: 'seasonal' })).toEqual([])
        expect(filterAchievements(undefined, { query: 'a' })).toBeUndefined()
    })
})
