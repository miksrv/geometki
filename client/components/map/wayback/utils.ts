import { WaybackRelease } from '@/api/apiWayback'

/** The archive is looked into at this zoom range: coarser tiles change in almost every release */
export const WAYBACK_MIN_LEVEL = 12
export const WAYBACK_MAX_LEVEL = 16

/** The tile under the map's center, whose changes are listed */
export const centerTile = (lat: number, lon: number, zoom: number) => {
    const z = Math.min(Math.max(Math.round(zoom), WAYBACK_MIN_LEVEL), WAYBACK_MAX_LEVEL)
    const n = 2 ** z
    const latRad = (lat * Math.PI) / 180

    return {
        x: Math.floor(((lon + 180) / 360) * n),
        y: Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n),
        z
    }
}

/**
 * The release to show: the chosen one when it is in the list of the area, otherwise the one closest
 * in time to it (after moving the map the choice stays the same year as far as possible)
 */
export const pickRelease = (list: WaybackRelease[], chosen?: WaybackRelease): WaybackRelease | undefined => {
    if (!chosen || !list.length) {
        return list[0]
    }

    const time = (release: WaybackRelease) => new Date(release.date).getTime()

    return (
        list.find(({ id }) => id === chosen.id) ??
        list.reduce((best, release) =>
            Math.abs(time(release) - time(chosen)) < Math.abs(time(best) - time(chosen)) ? release : best
        )
    )
}
