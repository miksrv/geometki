// TODO: Refactoring this file, change function() to arrow function

import { ApiType } from '@/api'

const reInteger = '\\d+'
const reFractional = '\\d+(?:\\.\\d+)?'
const reSignedFractional = '-?\\d+(?:\\.\\d+)?'
const reHemisphere = '[NWSE]'

export const toDegreesMinutesAndSeconds = (coordinate: number): string => {
    const absolute = Math.abs(coordinate)
    const degrees = Math.floor(absolute)
    const minutesNotTruncated = (absolute - degrees) * 60
    const minutes = Math.floor(minutesNotTruncated)
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60)

    return `${degrees}°${minutes}’${seconds}"`
}

export const convertDMS = (lat?: number, lon?: number): string => {
    if (!lat || !lon) {
        return ''
    }

    const latitude = toDegreesMinutesAndSeconds(lat)
    const latitudeCardinal = lat >= 0 ? 'N' : 'S'

    const longitude = toDegreesMinutesAndSeconds(lon)
    const longitudeCardinal = lon >= 0 ? 'E' : 'W'

    return `${latitude}${latitudeCardinal} ${longitude}${longitudeCardinal}`
}

const regexps = {
    easternHemishphere: /[EeЕе]|[ВвB] *[Дд]?/gu, // second Ее is cyrillic
    northernHemishphere: /[Nn]|[СсCc] *[Шш]?/gu,
    southernHemishphere: /[Ss]|[Юю] *[Шш]?/gu,
    // This regexp wag generated using script at https://gist.github.com/wladich/3d15edc8fcd8b735ac883ef60fe10bfe
    // It matches all unicode characters except Lu (Uppercase Letter), Ll (Lowercase Letter)
    // and [0123456789,.-]. It ignores unassigned code points (Cn) and characters that are removed after NFKC
    // normalization.
    // Manually added: "oO" (lat), "оО" (rus)
    symbols:
        // eslint-disable-next-line max-len
        /[OoОо\u0000-\u002b\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00bf\u00d7\u00f7\u01bb\u01c0-\u01cc\u0294\u02b9-\u036f\u0375\u03f6\u0482-\u0489\u0559-\u055f\u0589-\u109f\u10fb\u10fc\u1100-\u139f\u1400-\u1c7f\u1cc0-\u1cff\u1d2f-\u1d6a\u1dc0-\u1dff\u1f88-\u1f8f\u1f98-\u1f9f\u1fa8-\u1faf\u1fbc-\u1fc1\u1fcc-\u1fcf\u1ffc-\u2131\u213a-\u214d\u214f-\u2182\u2185-\u2bff\u2ce5-\u2cea\u2cef-\u2cf1\u2cf9-\u2cff\u2d30-\ua63f\ua66e-\ua67f\ua69e-\ua721\ua788-\ua78a\ua78f\ua7f7-\ua7f9\ua7fb-\uab2f\uab5b-\uab5f\uabc0-\uffff]/gu,
    westernHemishphere: /[Ww]|[Зз] *[Дд]?/gu
}

export const normalizeInput = (inp: string): string => {
    let s = inp.normalize('NFKC') // convert subscripts and superscripts to normal chars
    s = ' ' + s + ' '
    // replace everything that is not letter, number, minus, dot or comma to space
    s = s.replace(regexps.symbols, ' ')
    // remove all dots and commas if they are not between digits
    s = s.replace(/[,.](?=\D)/gu, ' ')
    s = s.replace(/(\D)[,.]/gu, '$1 ') // lookbehind is not supported in all browsers
    // if dot is likely to be used as decimal separator, remove all commas
    if (s.includes('.')) {
        s = s.replace(/,/gu, ' ')
    } else {
        // otherwise comma is decimal separator
        s = s.replace(/,/gu, '.')
    }
    s = s.replace(/-(?=\D)/gu, ' ') // remove all minuses that are not in the beginning of number
    s = s.replace(/([^ ])-/gu, '$1 ') // lookbehind is not supported in all browsers

    s = s.replace(regexps.northernHemishphere, ' N ')
    s = s.replace(regexps.southernHemishphere, ' S ')
    s = s.replace(regexps.westernHemishphere, ' W ')
    s = s.replace(regexps.easternHemishphere, ' E ')

    s = s.replace(/ +/gu, ' ') // compress whitespaces
    s = s.trim()

    return s
}

export const isCoordinates = (value: string): boolean => {
    const coordFieldRe = new RegExp(`^((${reHemisphere})|(${reSignedFractional}))$`, 'u')
    const coordNumbersFieldRe = new RegExp(`^(${reSignedFractional})$`, 'u')
    const fields = normalizeInput(value).split(' ')
    return (
        fields.length > 1 &&
        fields.every((field) => field.match(coordFieldRe)) &&
        fields.some((field) => field.match(coordNumbersFieldRe))
    )
}

const getLatitudeLetter = (latIsSouth: boolean) => (latIsSouth ? 'S' : 'N')

const getLongitudeLetter = (lonIsWest: boolean) => (lonIsWest ? 'W' : 'E')

const parseHemispheres = (h1: string, h2: string, h3: string, allowEmpty = false) => {
    const isLat = (h: string) => h === 'N' || h === 'S'

    let swapLatLon = false
    let hLat
    let hLon
    if (h1 && h2 && !h3) {
        hLat = h1.trim()
        hLon = h2.trim()
    } else if (h1 && !h2 && h3) {
        hLat = h1.trim()
        hLon = h3.trim()
    } else if (!h1 && h2 && h3) {
        hLat = h2.trim()
        hLon = h3.trim()
    } else if (allowEmpty && !h1 && !h2 && !h3) {
        return { empty: true }
    } else {
        return { error: true }
    }
    if (isLat(hLat) === isLat(hLon)) {
        return { error: true }
    }
    if (isLat(hLon)) {
        ;[hLat, hLon] = [hLon, hLat]
        swapLatLon = true
    }
    const latIsSouth = hLat === 'S'
    const lonIsWest = hLon === 'W'
    return { latIsSouth, lonIsWest, swapLatLon }
}

export const CoordinatesD = {
    create(
        latDeg: number,
        latIsSouth: boolean,
        lonDeg: number,
        lonIsWest: boolean
    ): {
        equalTo: (other: ReturnType<typeof CoordinatesD.create>) => boolean
        format: () => { latitude: string; longitude: string }
        getLatLng: () => ApiType.Coordinates
        isValid: () => boolean
        latDeg: number
        latIsSouth: boolean
        lonDeg: number
        lonIsWest: boolean
    } {
        return {
            equalTo: function (other: ReturnType<typeof CoordinatesD.create>) {
                return (
                    this.latDeg === other.latDeg &&
                    this.latIsSouth === other.latIsSouth &&
                    this.lonDeg === other.lonDeg &&
                    this.lonIsWest === other.lonIsWest
                )
            },
            format: function () {
                return {
                    latitude: `${getLatitudeLetter(this.latIsSouth)} ${this.latDeg}°`,
                    longitude: `${getLongitudeLetter(this.lonIsWest)} ${this.lonDeg}°`
                }
            },
            getLatLng: function (): ApiType.Coordinates {
                let lat = this.latDeg
                if (this.latIsSouth) {
                    lat = -lat
                }
                let lon = this.lonDeg
                if (this.lonIsWest) {
                    lon = -lon
                }
                return { lat: lat, lon: lon }
            },
            isValid: function () {
                return this.latDeg >= 0 && this.latDeg <= 90 && this.lonDeg >= 0 && this.lonDeg <= 180
            },
            latDeg,
            latIsSouth,
            lonDeg,
            lonIsWest
        }
    },

    fromString: function (s: string) {
        const m = s.match(this.regexp)
        if (!m) {
            return { error: true }
        }
        const [h1, d1Str, h2, d2Str, h3] = m.slice(1)
        const hemispheres = parseHemispheres(h1, h2, h3)
        if (hemispheres.error) {
            return { error: true }
        }
        let [d1, d2] = [d1Str, d2Str].map(parseFloat)
        if (hemispheres.swapLatLon) {
            ;[d1, d2] = [d2, d1]
        }
        const coord = this.create(d1, hemispheres.latIsSouth || false, d2, hemispheres.lonIsWest || false)
        if (coord.isValid()) {
            return {
                coordinates: [coord]
            }
        }
        return { error: true }
    },

    regexp: new RegExp(
        `^(${reHemisphere} )?(${reFractional}) (${reHemisphere} )?(${reFractional})( ${reHemisphere})?$`,
        'u'
    )
}

export const CoordinatesDM = {
    create(latDeg: number, latMin: number, latIsSouth: boolean, lonDeg: number, lonMin: number, lonIsWest: boolean) {
        return {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            equalTo: function (other) {
                return (
                    this.latDeg === other.latDeg &&
                    this.latMin === other.latMin &&
                    this.latIsSouth === other.latIsSouth &&
                    this.lonDeg === other.lonDeg &&
                    this.lonMin === other.lonMin &&
                    this.lonIsWest === other.lonIsWest
                )
            },
            format: function () {
                return {
                    latitude: `${getLatitudeLetter(this.latIsSouth)} ${this.latDeg}°${this.latMin}′`,
                    longitude: `${getLongitudeLetter(this.lonIsWest)} ${this.lonDeg}°${this.lonMin}′`
                }
            },
            getLatLng: function (): ApiType.Coordinates {
                let lat = this.latDeg + this.latMin / 60
                if (this.latIsSouth) {
                    lat = -lat
                }
                let lon = this.lonDeg + this.lonMin / 60
                if (this.lonIsWest) {
                    lon = -lon
                }
                return { lat: lat, lon: lon }
            },
            isValid: function () {
                return (
                    this.latDeg >= 0 &&
                    this.latDeg <= 90 &&
                    this.latMin >= 0 &&
                    this.latMin < 60 &&
                    this.lonDeg >= 0 &&
                    this.lonDeg <= 180 &&
                    this.lonMin >= 0 &&
                    this.lonMin < 60 &&
                    (this.latDeg <= 89 || this.latMin === 0) &&
                    (this.lonDeg <= 179 || this.lonMin === 0)
                )
            },
            latDeg,
            latIsSouth,
            latMin,
            lonDeg,
            lonIsWest,
            lonMin
        }
    },

    fromString: function (s: string) {
        const m = s.match(CoordinatesDM.regexp)
        if (!m) {
            return { error: true }
        }
        const [h1, d1Str, m1Str, h2, d2Str, m2Str, h3] = m.slice(1)
        const hemispheres = parseHemispheres(h1, h2, h3, true)
        if (hemispheres.error) {
            return { error: true }
        }
        let [d1, m1, d2, m2] = [d1Str, m1Str, d2Str, m2Str].map(parseFloat)
        const coords = []
        if (hemispheres.empty) {
            const coord1 = CoordinatesDM.create(d1, m1, false, d2, m2, false)
            const coord2 = CoordinatesDM.create(d2, m2, false, d1, m1, false)
            if (coord1.isValid()) {
                coords.push(coord1)
            }
            if (!coord1.equalTo(coord2) && coord2.isValid()) {
                coords.push(coord2)
            }
        } else {
            if (hemispheres.swapLatLon) {
                ;[d1, m1, d2, m2] = [d2, m2, d1, m1]
            }
            const coord = CoordinatesDM.create(
                d1,
                m1,
                hemispheres.latIsSouth || false,
                d2,
                m2,
                hemispheres.lonIsWest || false
            )
            if (coord.isValid()) {
                coords.push(coord)
            }
        }

        if (coords.length > 0) {
            return { coordinates: coords }
        }
        return { error: true }
    },

    regexp: new RegExp(
        `^(${reHemisphere} )?(${reInteger}) (${reFractional}) (${reHemisphere} )?(${reInteger}) (${reFractional})( ${reHemisphere})?$`,
        'u'
    )
}

export const CoordinatesDMS = {
    create(
        latDeg: number,
        latMin: number,
        latSec: number,
        latIsSouth: boolean,
        lonDeg: number,
        lonMin: number,
        lonSec: number,
        lonIsWest: boolean
    ) {
        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            equalTo: function (other: any) {
                return (
                    this.latDeg === other.latDeg &&
                    this.latMin === other.latMin &&
                    this.latSec === other.latSec &&
                    this.latIsSouth === other.latIsSouth &&
                    this.lonDeg === other.lonDeg &&
                    this.lonMin === other.lonMin &&
                    this.lonSec === other.lonSec &&
                    this.lonIsWest === other.lonIsWest
                )
            },
            format: function () {
                return {
                    latitude: `${getLatitudeLetter(this.latIsSouth)} ${this.latDeg}°${this.latMin}′${this.latSec}″`,
                    longitude: `${getLongitudeLetter(this.lonIsWest)} ${this.lonDeg}°${this.lonMin}′${this.lonSec}″`
                }
            },
            getLatLng: function (): ApiType.Coordinates {
                let lat = this.latDeg + this.latMin / 60 + this.latSec / 3600
                if (this.latIsSouth) {
                    lat = -lat
                }
                let lon = this.lonDeg + this.lonMin / 60 + this.lonSec / 3600
                if (this.lonIsWest) {
                    lon = -lon
                }
                return { lat: lat, lon: lon }
            },
            isValid: function () {
                return (
                    this.latDeg >= 0 &&
                    this.latDeg <= 90 &&
                    this.latMin >= 0 &&
                    this.latMin <= 59 &&
                    this.latSec >= 0 &&
                    this.latSec < 60 &&
                    this.lonDeg >= 0 &&
                    this.lonDeg <= 180 &&
                    this.lonMin >= 0 &&
                    this.lonMin <= 59 &&
                    this.lonSec >= 0 &&
                    this.lonSec < 60 &&
                    (this.latDeg <= 89 || (this.latMin === 0 && this.latSec === 0)) &&
                    (this.lonDeg <= 179 || (this.lonMin === 0 && this.lonSec === 0))
                )
            },
            latDeg,
            latIsSouth,
            latMin,
            latSec,
            lonDeg,
            lonIsWest,
            lonMin,
            lonSec
        }
    },

    fromString: function (s: string) {
        const m = s.match(CoordinatesDMS.regexp)
        if (!m) {
            return { error: true }
        }
        const [h1, d1Str, m1Str, s1Str, h2, d2Str, m2Str, s2Str, h3] = m.slice(1)
        const hemispheres = parseHemispheres(h1, h2, h3, true)
        if (hemispheres.error) {
            return { error: true }
        }
        let [d1, m1, s1, d2, m2, s2] = [d1Str, m1Str, s1Str, d2Str, m2Str, s2Str].map(parseFloat)
        const coords = []
        if (hemispheres.empty) {
            const coord1 = CoordinatesDMS.create(d1, m1, s1, false, d2, m2, s2, false)
            const coord2 = CoordinatesDMS.create(d2, m2, s2, false, d1, m1, s1, false)
            if (coord1.isValid()) {
                coords.push(coord1)
            }
            if (!coord1.equalTo(coord2) && coord2.isValid()) {
                coords.push(coord2)
            }
        } else {
            if (hemispheres.swapLatLon) {
                ;[d1, m1, s1, d2, m2, s2] = [d2, m2, s2, d1, m1, s1]
            }
            const coord = CoordinatesDMS.create(
                d1,
                m1,
                s1,
                hemispheres.latIsSouth || false,
                d2,
                m2,
                s2,
                hemispheres.lonIsWest || false
            )
            if (coord.isValid()) {
                coords.push(coord)
            }
        }
        if (coords.length > 0) {
            return { coordinates: coords }
        }
        return { error: true }
    },

    regexp: new RegExp(
        `^(${reHemisphere} )?(${reInteger}) (${reInteger}) (${reFractional}) (${reHemisphere} )?(${reInteger}) (${reInteger}) (${reFractional})( ${reHemisphere})?$`,
        'u'
    )
}

export const CoordinatesDSigned = {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    create(latDegSigned: number, lonDegSigned: number) {
        return {
            equalTo: function (other: ReturnType<typeof CoordinatesDSigned.create>) {
                return this.latDegSigned === other.latDegSigned && this.lonDegSigned === other.lonDegSigned
            },
            format: function () {
                return {
                    latitude: `${this.latDegSigned}°`,
                    longitude: `${this.lonDegSigned}°`
                }
            },
            getLatLng: function (): ApiType.Coordinates {
                return { lat: this.latDegSigned, lon: this.lonDegSigned }
            },
            isValid: function () {
                return (
                    this.latDegSigned >= -90 &&
                    this.latDegSigned <= 90 &&
                    this.lonDegSigned >= -180 &&
                    this.lonDegSigned <= 180
                )
            },
            latDegSigned,
            lonDegSigned
        }
    },

    fromString: function (s: string) {
        const m = s.match(CoordinatesDSigned.regexp)
        if (!m) {
            return { error: true }
        }
        const coords = []
        const [d1, d2] = m.slice(1).map(parseFloat)
        const coord1 = CoordinatesDSigned.create(d1, d2)
        if (coord1.isValid()) {
            coords.push(coord1)
        }
        const coord2 = CoordinatesDSigned.create(d2, d1)
        if (!coord1.equalTo(coord2)) {
            if (coord2.isValid()) {
                coords.push(coord2)
            }
        }
        if (coords.length === 0) {
            return { error: true }
        }
        return {
            coordinates: coords
        }
    },

    regexp: new RegExp(`^(${reSignedFractional}) (${reSignedFractional})$`, 'u')
}
