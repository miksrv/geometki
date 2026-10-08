/** known: enough information for a card; explore: interesting but unexplored; other: the rest */
export type Tier = 'known' | 'explore' | 'other'

/** open: not on Geometki; linked: linked to a place; duplicate: looks like an existing place (admins only) */
export type Status = 'open' | 'linked' | 'duplicate'

export type BreakdownCode =
    | 'type'
    | 'wiki'
    | 'nearbyWiki'
    | 'sitelinks'
    | 'protected'
    | 'photo'
    | 'description'
    | 'website'
    | 'names'
    | 'contour'
    | 'salt'
    | 'lakeSize'
    | 'dimensions'
    | 'noName'
    | 'private'

/** Why the object got its score: one signal with its points */
export interface BreakdownItem {
    code: BreakdownCode
    points: number
    value?: string | number
    distance?: number
}

/** A photo from Wikimedia Commons: shown only with its author and licence */
export interface Photo {
    file: string
    url: string
    /** The file page on Commons */
    page: string | null
    author: string | null
    license: string | null
    licenseUrl: string | null
}

export interface Settlement {
    name: string
    /** city, town, village or hamlet */
    type: string
    /** Meters from the settlement's edge, 0 means inside */
    distance: number
}

export interface Candidate {
    id: string
    /** osm: an OSM object (maybe enriched from Wikidata); wikidata: found only in Wikidata */
    source: 'osm' | 'wikidata'
    osmType: 'node' | 'way' | 'relation' | null
    osmId: number | null
    lat: number
    lon: number
    name: string | null
    typeTitle: string
    osmTag: string
    category: string | null
    tier: Tier
    score: number
    breakdown: BreakdownItem[]
    wikipedia: string | null
    wikidata: string | null
    photos: Photo[]
    /** A photo link from OSM without a known licence, only when there are no Commons photos */
    image: string | null
    /** Code of the Russian cultural heritage register */
    heritage: string | null
    ele: number | null
    /** Bounding box diagonal, meters */
    size: number | null
    settlement: Settlement | null
    status: Status
    place: { id: string; title: string | null; similarity?: number } | null
}

export interface ListRequest {
    /** south,west,north,east */
    bounds: string
    /** Comma separated tiers, known and explore by default */
    tiers?: string
}

export interface ListResponse {
    items: Candidate[]
    /** Tiles of the area that are not collected yet */
    pendingTiles: number
    tooLarge?: boolean
}

export interface LinkRequest {
    id: string
    placeId: string
}
