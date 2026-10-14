import { ApiType } from '@/api'

/**
 * The visitor's location, once they have asked for it (the map's "My location" button, sorting
 * by distance). It is kept in this cookie so that the next pages, server-rendered ones too, can
 * show distances without asking the browser again; the API gets it as explicit `lat`/`lon`.
 * The server stores nothing for anonymous visitors (only a signed-in user's last point).
 */
export const USER_LOCATION_COOKIE = 'location'

// 30 days, in seconds
export const USER_LOCATION_MAX_AGE = 30 * 24 * 60 * 60

// 3 decimal places ≈ 100 m: enough for distances, and no more precise than needed
const LOCATION_PRECISION = 3

export const roundLocation = (lat: number, lon: number): ApiType.Coordinates => ({
    lat: Number(lat.toFixed(LOCATION_PRECISION)),
    lon: Number(lon.toFixed(LOCATION_PRECISION))
})

export const serializeUserLocation = ({ lat, lon }: ApiType.Coordinates): string => `${lat};${lon}`

export const parseUserLocation = (value?: string | null): ApiType.Coordinates | undefined => {
    const [lat, lon] = (value ?? '').split(';').map((part) => (part.trim() === '' ? NaN : Number(part)))

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return undefined
    }

    if (lat === 0 && lon === 0) {
        return undefined
    }

    return roundLocation(lat, lon)
}

/** The visitor's location from the request cookies, for server-rendered distances */
export const getUserLocationFromCookies = (cookies: Partial<Record<string, string>>): ApiType.Coordinates | undefined =>
    parseUserLocation(cookies[USER_LOCATION_COOKIE])

/**
 * The point that distances are counted from: the one in the URL (`?lat=&lon=`), else the visitor's own.
 */
export const getDistanceOrigin = (
    lat: number | null | undefined,
    lon: number | null | undefined,
    cookies: Partial<Record<string, string>>
): ApiType.Coordinates | undefined => (lat && lon ? { lat, lon } : getUserLocationFromCookies(cookies))
