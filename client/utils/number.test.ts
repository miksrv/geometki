import { addDecimalPoint, numberFormatter, ratingColor, round } from './number'

describe('round', () => {
    it('returns undefined when value is undefined', () => {
        expect(round(undefined)).toBeUndefined()
    })

    it('returns undefined when value is 0 (falsy)', () => {
        expect(round(0)).toBeUndefined()
    })

    it('rounds to 4 decimal places by default', () => {
        expect(round(3.14159265)).toBe(3.1416)
    })

    it('rounds to a custom number of digits', () => {
        expect(round(3.14159265, 2)).toBe(3.14)
        expect(round(3.14159265, 0)).toBe(3)
    })

    it('preserves integers', () => {
        expect(round(42, 4)).toBe(42)
    })
})

describe('numberFormatter', () => {
    it('returns the original number for values less than 1', () => {
        expect(numberFormatter(0)).toBe(0)
        expect(numberFormatter(0.5)).toBe(0.5)
    })

    it('formats numbers 1–999 without suffix', () => {
        expect(numberFormatter(1)).toBe('1')
        expect(numberFormatter(999)).toBe('999')
    })

    it('formats thousands with k suffix', () => {
        expect(numberFormatter(1000)).toBe('1k')
        expect(numberFormatter(1500)).toBe('1.5k')
    })

    it('formats millions with M suffix', () => {
        expect(numberFormatter(1e6)).toBe('1M')
        expect(numberFormatter(2.5e6)).toBe('2.5M')
    })

    it('formats billions with G suffix', () => {
        expect(numberFormatter(1e9)).toBe('1G')
    })

    it('formats trillions with T suffix', () => {
        expect(numberFormatter(1e12)).toBe('1T')
    })

    it('respects a custom digits parameter', () => {
        expect(numberFormatter(1500, 2)).toBe('1.5k')
    })
})

describe('ratingColor', () => {
    it('returns red for value <= 1', () => {
        expect(ratingColor(0)).toBe('red')
        expect(ratingColor(1)).toBe('red')
    })

    it('returns orange for 1 < value < 3', () => {
        expect(ratingColor(2)).toBe('orange')
        expect(ratingColor(1.1)).toBe('orange')
        expect(ratingColor(2.9)).toBe('orange')
    })

    it('returns green for value >= 3', () => {
        expect(ratingColor(3)).toBe('green')
        expect(ratingColor(5)).toBe('green')
    })
})

describe('addDecimalPoint', () => {
    it('returns empty string for undefined', () => {
        expect(addDecimalPoint(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
        expect(addDecimalPoint('')).toBe('')
    })

    it('appends .0 to an integer', () => {
        expect(addDecimalPoint(5)).toBe('5.0')
        expect(addDecimalPoint('42')).toBe('42.0')
    })

    it('appends 0 when decimal point is trailing', () => {
        expect(addDecimalPoint('3.')).toBe('3.0')
    })

    it('preserves existing decimal digits', () => {
        expect(addDecimalPoint('3.14')).toBe('3.14')
        expect(addDecimalPoint(2.5)).toBe('2.5')
    })
})
