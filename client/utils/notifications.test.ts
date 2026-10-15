import { TFunction } from 'i18next'

import { getActivityTitle, getNotificationText, getNotificationTitle } from './notifications'

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

describe('getNotificationTitle', () => {
    it('prefers an explicit title, even an empty one', () => {
        expect(getNotificationTitle({ id: '1', title: '', type: 'error' }, t)).toBe('')
        expect(getNotificationTitle({ id: '1', title: 'Custom', type: 'photo' }, t)).toBe('Custom')
    })

    it('names the activity, then the type', () => {
        expect(getNotificationTitle({ activity: 'photo', id: '1', type: 'comment' }, t)).toBe(
            'Загружена новая фотография'
        )
        expect(getNotificationTitle({ id: '1', type: 'level' }, t)).toBe('Новый уровень!')
    })

    it('adds the XP to an experience notification', () => {
        expect(getNotificationTitle({ activity: 'rating', id: '1', meta: { value: 5 }, type: 'experience' }, t)).toBe(
            'Поставлена новая оценка +5 XP'
        )
    })
})

describe('getNotificationText', () => {
    it('describes experience, level and achievement notifications', () => {
        expect(getNotificationText({ id: '1', meta: { value: 5 }, type: 'experience' }, t)).toBe('+5 опыта')
        expect(getNotificationText({ id: '1', meta: { level: 3, title: 'Scout' }, type: 'level' }, t)).toBe('Scout (3)')
        expect(getNotificationText({ id: '1', meta: { title: 'First photo' }, type: 'achievements' }, t)).toBe(
            'First photo'
        )
    })

    it('falls back to the message', () => {
        expect(getNotificationText({ id: '1', message: 'Saved', type: 'success' }, t)).toBe('Saved')
        expect(getNotificationText({ id: '1', type: 'photo' }, t)).toBe('')
    })
})
