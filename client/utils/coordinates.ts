/**
 * A coordinate as degrees, minutes and seconds: the copy-coordinates line, the search result and
 * the map's place mark. Parsing a typed coordinate is the server's (`GET /search`).
 */
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
