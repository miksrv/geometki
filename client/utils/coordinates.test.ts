import { isCoordinates, normalizeInput, toDegreesMinutesAndSeconds } from '@/utils/coordinates'

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

describe('normalizeInput', () => {
    it('normalizes input string correctly', () => {
        const input = '⁰ⁱ²³⁴⁵⁶⁷⁸⁹'
        const expectedOutput = '0i23456789'
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })

    it('replaces symbols correctly', () => {
        const input = '!@#$%^&*()_+={}[]|\\:;"\'<>,.?/~`'
        const expectedOutput = ''
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })

    it('handles decimal separator correctly (comma)', () => {
        const input = '1,234.567'
        const expectedOutput = '1 234.567'
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })

    it('handles decimal separator correctly (dot)', () => {
        const input = '1.234,567'
        const expectedOutput = '1.234 567'
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })

    it('replaces dashes correctly', () => {
        const input = '123-456-789'
        const expectedOutput = '123 456 789'
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })

    it('replaces hemisphere markers correctly', () => {
        const input = 'N, S, W, E'
        const expectedOutput = 'N S W E'
        expect(normalizeInput(input)).toStrictEqual(expectedOutput)
    })
})

describe('CoordinatesProvider - parse good coordinates', () => {
    ;[
        ['55 37', ['55° 37°', '37° 55°']],
        ['55° 55°', ['55° 55°']],
        ['55.94920° 36.82205°', ['55.9492° 36.82205°', '36.82205° 55.9492°']],
        ['N 55.93382° E 36.93604°', ['N 55.93382° E 36.93604°']],
        ['N 55°52.981′ E 36°59.540′', ['N 55°52.981′ E 36°59.54′']],
        ['N 55°49′02.95″ E 37°03′09.95″', ['N 55°49′2.95″ E 37°3′9.95″']],
        ['-55° 37°', ['-55° 37°', '37° -55°']],
        ['-55.94920 36.82205', ['-55.9492° 36.82205°', '36.82205° -55.9492°']],
        ['S 55.93382° E 36.93604°', ['S 55.93382° E 36.93604°']],
        ['S 55°52.981′ E 36°59.540′', ['S 55°52.981′ E 36°59.54′']],
        ['S 55°49′02.95″ E 37°03′09.95″', ['S 55°49′2.95″ E 37°3′9.95″']],
        ['55° -37°', ['55° -37°', '-37° 55°']],
        ['55.94920 -36.82205', ['55.9492° -36.82205°', '-36.82205° 55.9492°']],
        ['N 55.93382° W 36.93604°', ['N 55.93382° W 36.93604°']],
        ['N 55°52.981′ W 36°59.540′', ['N 55°52.981′ W 36°59.54′']],
        ['N 55°49′02.95″ W 37°03′09.95″', ['N 55°49′2.95″ W 37°3′9.95″']],

        // swap lat/lon
        ['S 1 2 3 E 4 5 6', ['S 1°2′3″ E 4°5′6″']],
        ['E 1 2 3 S 4 5 6', ['S 4°5′6″ E 1°2′3″']],
        ['N 1 2 E 4 5', ['N 1°2′ E 4°5′']],
        ['E 1 2 N 4 5', ['N 4°5′ E 1°2′']],
        ['N 1 E 4', ['N 1° E 4°']],
        ['E 1 N 4', ['N 4° E 1°']],

        // minimal whitespaces, placing hemispheres
        ['N55.93382 E36.93604', ['N 55.93382° E 36.93604°']],
        ['55.93382N36.93604E', ['N 55.93382° E 36.93604°']],
        ['N55.93382,36.93604E', ['N 55.93382° E 36.93604°']],
        ['S55°52.981′ W36°59.540′', ['S 55°52.981′ W 36°59.54′']],
        ['S55°52.981′,36°59.540′W', ['S 55°52.981′ W 36°59.54′']],
        ['55°52.981′S36°59.540′W', ['S 55°52.981′ W 36°59.54′']],
        ['36°59.540′W55°52.981′S', ['S 55°52.981′ W 36°59.54′']],
        ['N55°49′02.95″,W37°03′09.95″', ['N 55°49′2.95″ W 37°3′9.95″']],
        ['55°49′02.95″N37°03′09.95″W', ['N 55°49′2.95″ W 37°3′9.95″']],
        ['N55°49′02.95″,37°03′09.95″W', ['N 55°49′2.95″ W 37°3′9.95″']],

        // types of hemispheres
        ['s 55.93382 w 36.93604', ['S 55.93382° W 36.93604°']],
        ['55.93382 юш 36.93604 зд', ['S 55.93382° W 36.93604°']],
        ['55.93382 ю ш 36.93604 з д', ['S 55.93382° W 36.93604°']],
        ['55.93382 ю. ш. 36.93604 з. д.', ['S 55.93382° W 36.93604°']],
        ['55.93382 с.ш. 36.93604 в.д.', ['N 55.93382° E 36.93604°']],
        [`43°20'13"С, 42°27'24"В`, ['N 43°20′13″ E 42°27′24″']], // eslint-disable-line quotes
        [`43°20'13"N, 42°27'24"В`, ['N 43°20′13″ E 42°27′24″']], // eslint-disable-line quotes
        ["57°57'11.65''C|33°16'8.37''В", ['N 57°57′11.65″ E 33°16′8.37″']], // eslint-disable-line quotes

        // margin values
        ['0 0', ['0° 0°']],
        ['-0 -0', ['0° 0°']],
        ['N 0 E 0', ['N 0° E 0°']],
        ['N 0 0 E 0 0', ['N 0°0′ E 0°0′']],
        ['N 0 0 0 E 0 0 0', ['N 0°0′0″ E 0°0′0″']],
        ['90 180', ['90° 180°']],
        ['-90 -180', ['-90° -180°']],
        ['N 90 E180', ['N 90° E 180°']],
        ['N 89 59 E179 59', ['N 89°59′ E 179°59′']],
        ['N 89 59 59 E179 59 59', ['N 89°59′59″ E 179°59′59″']],

        // floating point
        ['55,2 37,6', ['55.2° 37.6°', '37.6° 55.2°']],
        ['N 55,93382° E 36,93604°', ['N 55.93382° E 36.93604°']],
        ['S 55°52,981′ E 36°59,540′', ['S 55°52.981′ E 36°59.54′']],
        ['S 55°49′02,95″ E 37°03′09,95″', ['S 55°49′2.95″ E 37°3′9.95″']],
        ['55.2,37.6', ['55.2° 37.6°', '37.6° 55.2°']],

        // junk
        ['55.94920-36.82205', ['55.9492° 36.82205°', '36.82205° 55.9492°']],
        ['- 55.94920- 36.82205-', ['55.9492° 36.82205°', '36.82205° 55.9492°']],

        ['N 43º 12 13  E 58º 14 15', ['N 43°12′13″ E 58°14′15″']],
        ['N 43о 12 13  E 58О 14 15', ['N 43°12′13″ E 58°14′15″']], // rus
        ['N 43o 12 13  E 58O 14 15', ['N 43°12′13″ E 58°14′15″']], // lat

        // without hemispheres
        ['1 2.8 3 4.9', ['N 1°2.8′ E 3°4.9′', 'N 3°4.9′ E 1°2.8′']],
        ['1 2 3.8 4 5 6.9', ['N 1°2′3.8″ E 4°5′6.9″', 'N 4°5′6.9″ E 1°2′3.8″']],
        ['1 2 1 2', ['N 1°2′ E 1°2′']],
        ['1 2 3 1 2 3', ['N 1°2′3″ E 1°2′3″']]
    ].forEach(function ([query]) {
        it(`Parse ${query as string}`, async function () {
            expect(isCoordinates(`${query as string}`)).toBeTruthy()

            // let error = true
            //
            // for (const parser of [
            //     Coordinates.CoordinatesD,
            //     Coordinates.CoordinatesDM,
            //     Coordinates.CoordinatesDMS,
            //     Coordinates.CoordinatesDSigned
            // ]) {
            //     const result = parser.fromString(query)
            //
            //     if (!result?.error) {
            //         error = false
            //         return
            //     }
            // }
            //
            // expect(error).toBeFalsy()
        })
    })
})

describe('CoordinatesProvider - not coordinates', () => {
    ;[
        '',
        'aaa',
        '111',
        '1.23',
        '-1.23',
        '1 a',
        '55 a 37',
        '55 37 a',
        'a 55 37',
        '55a37',
        '55 37a',
        'a55 37',
        '8 мая 122/43',
        'wee'
    ].forEach(function (query) {
        it(`Not a coordinates string ${query}`, async function () {
            expect(isCoordinates(`${query}`)).toBeFalsy()
        })
    })
})
