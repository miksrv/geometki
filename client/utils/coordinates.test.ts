import { convertDMS, toDegreesMinutesAndSeconds } from '@/utils/coordinates'

describe('toDegreesMinutesAndSeconds', () => {
    it('converts positive coordinate correctly', () => {
        expect(toDegreesMinutesAndSeconds(37.7749)).toBe('37°46’29"')
    })

    it('converts negative coordinate correctly', () => {
        expect(toDegreesMinutesAndSeconds(-122.4194)).toBe('122°25’9"')
    })

    it('handles zero coordinate correctly', () => {
        expect(toDegreesMinutesAndSeconds(0)).toBe('0°0’0"')
    })

    it('handles non-integer coordinate correctly', () => {
        expect(toDegreesMinutesAndSeconds(52.52)).toBe('52°31’12"')
    })
})

describe('convertDMS', () => {
    it('joins both coordinates with their hemispheres', () => {
        expect(convertDMS(53.1, -57.25)).toBe('53°6’0"N 57°15’0"W')
    })

    it('gives nothing without a coordinate', () => {
        expect(convertDMS(undefined, 57)).toBe('')
    })
})
