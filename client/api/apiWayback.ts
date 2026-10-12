import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

/** A release of the ESRI World Imagery archive (Wayback): the imagery as it was published that day */
export type WaybackRelease = {
    id: number
    /** YYYY-MM-DD */
    date: string
}

type WaybackConfig = Record<string, { itemTitle: string }>

export type WaybackTilemap = {
    /** [1] when the release has the tile */
    data: number[]
    /** The release the tile was actually taken from, when it is an older one */
    select?: number[]
}

export type RequestGetTilemap = {
    release: number
    z: number
    x: number
    y: number
}

const CONFIG_URL = 'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'
const TILEMAP_URL = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tilemap'

export const WAYBACK_TILE_URL =
    'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{release}/{z}/{y}/{x}'

/** All releases, newest first */
export const parseWaybackConfig = (config: WaybackConfig): WaybackRelease[] =>
    Object.entries(config)
        .map(([id, { itemTitle }]) => ({ date: /\d{4}-\d{2}-\d{2}/.exec(itemTitle)?.[0] ?? '', id: Number(id) }))
        .filter(({ id, date }) => Number.isFinite(id) && date)
        .sort((a, b) => b.date.localeCompare(a.date))

/**
 * The releases in which the imagery of a tile changed, newest first. Most releases repeat the tile
 * of an older one, and the tilemap says which one: so the walk jumps from a release straight to
 * the one its tile came from and goes on from the release before it, one request per change.
 * `onChange` gets the list after each found change, `isCancelled` stops the walk between requests
 */
export const collectLocalChanges = async (
    releases: WaybackRelease[],
    getTilemap: (release: number) => Promise<WaybackTilemap>,
    onChange?: (changes: WaybackRelease[]) => void,
    isCancelled?: () => boolean
): Promise<WaybackRelease[]> => {
    const indexById = new Map(releases.map((release, index) => [release.id, index]))
    const changes: WaybackRelease[] = []

    for (let index = 0; index < releases.length && !isCancelled?.(); ) {
        const tilemap = await getTilemap(releases[index].id)

        if (!tilemap.data?.[0] || isCancelled?.()) {
            break
        }

        const sourceIndex = indexById.get(tilemap.select?.[0] ?? releases[index].id) ?? index

        changes.push(releases[sourceIndex])
        onChange?.([...changes])
        index = Math.max(sourceIndex, index) + 1
    }

    return changes
}

export const APIWayback = createApi({
    baseQuery: fetchBaseQuery({ baseUrl: '' }),
    endpoints: (builder) => ({
        // The same for every tile: asked once per page
        getReleases: builder.query<WaybackRelease[], void>({
            keepUnusedDataFor: 3600,
            query: () => CONFIG_URL,
            transformResponse: parseWaybackConfig
        }),
        // Kept for an hour: coming back to a place walks its releases again without requests
        getTilemap: builder.query<WaybackTilemap, RequestGetTilemap>({
            keepUnusedDataFor: 3600,
            query: ({ release, z, x, y }) => `${TILEMAP_URL}/${release}/${z}/${y}/${x}`
        })
    }),
    reducerPath: 'APIWayback'
})
