import { adminListHref } from './admin'

describe('adminListHref', () => {
    it('adds the filters that are set as the query', () => {
        expect(adminListHref('/admin/mailings')).toBe('/admin/mailings')
        expect(adminListHref('/admin/mailings', { page: undefined, status: 'draft' })).toBe(
            '/admin/mailings?status=draft'
        )
        expect(adminListHref('/admin/achievements', { query: 'первый шаг' })).toBe(
            '/admin/achievements?query=%D0%BF%D0%B5%D1%80%D0%B2%D1%8B%D0%B9%20%D1%88%D0%B0%D0%B3'
        )
    })
})
