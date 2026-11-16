import { adminListHref, isAdminPeriod } from './admin'

describe('adminListHref', () => {
    it('adds the filters that are set as the query', () => {
        expect(adminListHref('/admin/sending-mail')).toBe('/admin/sending-mail')
        expect(adminListHref('/admin/sending-mail', { email: undefined, period: '7d', status: 'error' })).toBe(
            '/admin/sending-mail?period=7d&status=error'
        )
        expect(adminListHref('/admin/achievements', { query: 'первый шаг' })).toBe(
            '/admin/achievements?query=%D0%BF%D0%B5%D1%80%D0%B2%D1%8B%D0%B9%20%D1%88%D0%B0%D0%B3'
        )
    })
})

describe('isAdminPeriod', () => {
    it('knows the periods of a log', () => {
        expect(isAdminPeriod('7d')).toBe(true)
        expect(isAdminPeriod('year')).toBe(false)
        expect(isAdminPeriod(undefined)).toBe(false)
    })
})
