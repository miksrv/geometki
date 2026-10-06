import { TFunction } from 'i18next'

import { getActivityTitle } from './notifications'

const t = jest.fn(
    (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
) as unknown as TFunction

describe('getActivityTitle', () => {
    it('returns the title for photo', () => {
        expect(getActivityTitle('photo', t)).toBe('Загружена новая фотография')
    })

    it('returns the title for place', () => {
        expect(getActivityTitle('place', t)).toBe('Добавлена новая геометка')
    })

    it('returns the title for collection', () => {
        expect(getActivityTitle('collection', t)).toBe('Создана новая коллекция')
    })

    it('returns the title for collection_place', () => {
        expect(getActivityTitle('collection_place', t)).toBe('Ваше место добавлено в коллекцию')
    })

    it('returns an empty string for undefined', () => {
        expect(getActivityTitle(undefined, t)).toBe('')
    })

    it('returns an empty string for unhandled types', () => {
        expect(getActivityTitle('experience', t)).toBe('')
        expect(getActivityTitle('info', t)).toBe('')
        expect(getActivityTitle('success', t)).toBe('')
    })
})
