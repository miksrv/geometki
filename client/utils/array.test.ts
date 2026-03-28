import { equalsArrays } from './array'

describe('equalsArrays', () => {
    it('returns true when both are undefined', () => {
        expect(equalsArrays(undefined, undefined)).toBe(true)
    })

    it('returns true when both are empty', () => {
        expect(equalsArrays([], [])).toBe(true)
    })

    it('returns true when one is undefined and the other empty', () => {
        expect(equalsArrays(undefined, [])).toBe(true)
        expect(equalsArrays([], undefined)).toBe(true)
    })

    it('returns false when one is empty and the other has items', () => {
        expect(equalsArrays(['a'], [])).toBe(false)
        expect(equalsArrays([], ['a'])).toBe(false)
        expect(equalsArrays(['a'], undefined)).toBe(false)
        expect(equalsArrays(undefined, ['a'])).toBe(false)
    })

    it('returns true for arrays with the same items in the same order', () => {
        expect(equalsArrays(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
    })

    it('returns true for arrays with the same items in different order', () => {
        expect(equalsArrays(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(true)
    })

    it('returns false for arrays with different items', () => {
        expect(equalsArrays(['a', 'b'], ['a', 'x'])).toBe(false)
    })

    it('returns false for arrays with different lengths', () => {
        expect(equalsArrays(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
    })
})
