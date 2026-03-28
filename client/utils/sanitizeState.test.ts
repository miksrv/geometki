import { sanitizeForSerialization } from './sanitizeState'

describe('sanitizeForSerialization', () => {
    describe('primitives and null', () => {
        it('returns null for undefined input', () => {
            expect(sanitizeForSerialization(undefined)).toBeNull()
        })

        it('returns null as-is', () => {
            expect(sanitizeForSerialization(null)).toBeNull()
        })

        it('returns strings as-is', () => {
            expect(sanitizeForSerialization('hello')).toBe('hello')
        })

        it('returns numbers as-is', () => {
            expect(sanitizeForSerialization(42)).toBe(42)
        })

        it('returns booleans as-is', () => {
            expect(sanitizeForSerialization(true)).toBe(true)
            expect(sanitizeForSerialization(false)).toBe(false)
        })
    })

    describe('objects', () => {
        it('returns a copy of a flat object unchanged when no undefineds', () => {
            const input = { a: 1, b: 'two', c: true }
            expect(sanitizeForSerialization(input)).toEqual(input)
        })

        it('omits keys with undefined values', () => {
            const input = { a: 1, b: undefined, c: 'three' }
            const result = sanitizeForSerialization(input)
            expect(result).toEqual({ a: 1, c: 'three' })
            expect('b' in (result as object)).toBe(false)
        })

        it('recursively processes nested objects', () => {
            const input = { outer: { inner: undefined, keep: 42 } }
            const result = sanitizeForSerialization(input)
            expect(result).toEqual({ outer: { keep: 42 } })
        })

        it('converts nested undefined values to null inside arrays', () => {
            const input = [undefined, 1, undefined, 'x']
            const result = sanitizeForSerialization(input)
            expect(result).toEqual([null, 1, null, 'x'])
        })

        it('handles deeply nested structures', () => {
            const input = { a: { b: { c: undefined, d: 'value' } } }
            const result = sanitizeForSerialization(input)
            expect(result).toEqual({ a: { b: { d: 'value' } } })
        })
    })

    describe('arrays', () => {
        it('returns an empty array for an empty array', () => {
            expect(sanitizeForSerialization([])).toEqual([])
        })

        it('returns array of primitives unchanged', () => {
            expect(sanitizeForSerialization([1, 2, 3])).toEqual([1, 2, 3])
        })

        it('converts undefined elements in an array to null', () => {
            // eslint-disable-next-line no-sparse-arrays
            expect(sanitizeForSerialization([undefined, 'a'])).toEqual([null, 'a'])
        })

        it('recursively sanitizes objects inside arrays', () => {
            const input = [{ a: 1, b: undefined }, { c: 3 }]
            expect(sanitizeForSerialization(input)).toEqual([{ a: 1 }, { c: 3 }])
        })
    })
})
