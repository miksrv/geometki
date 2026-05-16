import { getDimension } from './utils'

describe('getDimension', () => {
    it('returns 36 for medium size', () => {
        expect(getDimension('medium')).toBe(36)
    })

    it('returns 28 for tiny size', () => {
        expect(getDimension('tiny')).toBe(28)
    })

    it('returns 20 for small size', () => {
        expect(getDimension('small')).toBe(20)
    })

    it('returns 20 when size is undefined (default)', () => {
        expect(getDimension(undefined)).toBe(20)
    })
})
