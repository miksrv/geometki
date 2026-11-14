import { ApiModel, ApiType } from '@/api'

/** The halves of the year: the warm one (April — September) and the cold one (October — March) */
export type SeasonKey = 'warm' | 'cold'

export interface Season {
    /** `2026-cold`; a cold season is named by the year it starts in */
    id: string
    key: SeasonKey
    year: number
    /** The first and the last day, `YYYY-MM-DD` */
    from: string
    to: string
    /** Days until the season ends, today included; 0 once it is over */
    daysLeft: number
    /** The last day a photo shot within the season still counts */
    lastDay: string
    /** The season's picture, drawn by the owner; a badge is drawn in its place without one */
    image?: string | null
    /** Its table is frozen */
    closed: boolean
    /** Today is within it */
    current: boolean
}

/** The public table of points: every number of the formula */
export interface Rules {
    /** The points of a confirmed place before the factors */
    base: number
    /** The factor of a category; a category not listed is 1 */
    categories: Partial<Record<ApiModel.Categories, number>>
    /** The bonus to the first ones of the season at a place: up to this place in the queue → factor */
    order: Array<{ upTo: number; factor: number }>
    photoBonus: number
    spotBonus: number
    graceDays: number
    /** "Near the place", metres: the default and by category */
    radius: number
    radiuses: Partial<Record<ApiModel.Categories, number>>
}

/**
 * An award that can be earned only within a season: a limited achievement whose dates lie
 * inside the season's. Nothing but the dates ties it to the season.
 */
export interface LimitedAward {
    id: string
    title: string
    description: string | null
    image: string | null
    tier: string
    category: string
    group: string
    /** The first and the last day it can be earned, `YYYY-MM-DD` */
    from: string
    to: string
    experience: number
    /** Signed-in visitor only: when they earned it, and how far they are */
    earned: string | null
    progress: { current: number; required: number; pct: number } | null
}

/** A person's line of a table; `place` is null while they have no points there */
export interface Standing {
    place: number | null
    points: number
    places: number
    quests: number
    players: number
    /** The points to the player above; null for the first one */
    ahead: number | null
    /** The points over the player below; null for the last one */
    behind?: number | null
    /**
     * `GET /game?rivals=1` only: the players right above and below — whom to catch up with, who
     * is catching up; for someone without geopoints the last player of the table is the one above
     */
    rivals?: { above?: Leader; below?: Leader }
}

export interface Leader {
    place: number
    points: number
    places: number
    quests: number
    user: ApiModel.User
}

/** `GET /game` */
export interface GetResponse {
    season: Season
    rules: Rules
    /** The limited awards of the season's dates */
    awards: LimitedAward[]
    totals: { players: number; places: number; quests: number }
    /** Signed-in visitor only */
    me?: Standing
    /** The closed seasons with their podiums, the latest first */
    seasons: Array<Season & { players: number; places: number; winners: Leader[] }>
}

/** A location the season is played in: a scope of the rating */
export interface LeadersLocation {
    type: ApiType.LocationTypes
    id: number
    title: string
    slug: string | null
    players: number
    points: number
}

/** `GET /game/leaders`: the current season and everywhere without the parameters */
export interface LeadersRequest {
    season?: string
    type?: ApiType.LocationTypes
    id?: number
    limit?: number
    offset?: number
}

export interface LeadersResponse {
    items: Leader[]
    count: number
    /** Signed-in visitor with points in this table only */
    me?: Standing
    locations: LeadersLocation[]
}

/** `GET /game/seasons/:id` */
export interface SeasonResponse {
    season: Season
    awards: LimitedAward[]
    totals: { players: number; places: number }
    winners: Leader[]
    me?: Standing
}

/** A place with what its confirmation gives now */
export type ValuablePlace = ApiModel.PlaceListItem & {
    game: {
        points: number
        /** The visitor would be the N-th to confirm it this season */
        position: number
    }
}

/** `GET /game/places`: with a point — of the places nearest to it */
export interface PlacesRequest {
    lat?: number
    lon?: number
    limit?: number
}

export interface PlacesResponse {
    items: ValuablePlace[]
    count: number
}

/** A place counted for the visitor in the current season */
export interface MineItem {
    id: string
    points: number
    way: 'photo' | 'geo' | null
    created: ApiType.DateTime
    place: ApiModel.PlaceListItem
}

/** `GET /game/mine`: the visitor's own chronicle of the current season, the latest first */
export interface MineResponse {
    items: MineItem[]
    /** All the places counted for them, and what they add up to */
    count: number
    points: number
}

/** A person's explored share of a location: the places they visited or added, of all the places there */
export interface ExploredLocation {
    type: ApiType.LocationTypes
    id: number
    title: string
    slug: string | null
    explored: number
    total: number
}

/** `GET /game/exploration?user=` */
export interface ExplorationResponse {
    /** The share of the whole map: the places visited, of all the places of the site */
    world?: { explored: number; total: number }
    regions: ExploredLocation[]
    localities: ExploredLocation[]
}

/** A season a person took part in: has a counted place in */
export interface Participation {
    id: string
    key: SeasonKey
    year: number
    image: string | null
    closed: boolean
    points: number
    places: number
    /** Their place in the season's table: the frozen one of a closed season, the live one of an open one */
    place: number | null
}

/** `GET /game/users/:id`: a person in the game, for their profile */
export interface UserResponse extends Standing {
    season: Season
    /** Confirmed places of all time */
    confirmed: number
    /** Quests walked to the end */
    walked: number
    /** The seasons they took part in, the latest first: the season badges of the profile */
    seasons: Participation[]
}

/** The place in the game for the visitor: a part of `GET /visits/me` */
export interface PlaceGame {
    season: string
    /** What "I am here" gives now */
    points: number
    position: number
    /** A photo shot at the place adds this */
    photoBonus: number
    /** "Near the place", metres */
    radius: number
    /** The visitor's score of the season here: counted once; null while there is none */
    earned: number | null
    way: 'photo' | 'geo' | null
}

export type QuestMode = 'open' | 'steps' | 'riddles' | 'photos'
export type QuestStatus = 'draft' | 'published'
export type QuestPointState = 'done' | 'current' | 'open' | 'locked'

/** The visitor's walk of a quest */
export interface QuestWalk {
    id: string
    started: string
    finished: string | null
    /** Points confirmed */
    confirmed: number
}

/** The search zone of a riddle quest; `radius` in metres */
export interface QuestZone {
    lat: number
    lon: number
    radius: number
}

export interface Quest {
    id: string
    title: string
    description: string | null
    mode: QuestMode
    status: QuestStatus
    /** Metres: the sum of the straight lines between the points */
    length: number
    /** How many points */
    points: number
    /** How many people walked it to the end */
    walked: number
    /** The experience walking it to the end gives: a quest is no part of a season */
    bonus: number
    updated?: ApiType.DateTime | null
    /** The town (or the region) of the first point */
    location?: string | null
    /** The cover of the first point; a riddle quest has none */
    cover?: { full?: string; preview: string }
    /** The first point, where the quest begins: the list's map; a riddle quest has none */
    start?: { lat: number; lon: number }
    /**
     * A riddle quest's search zone in place of its points: a circle holding all of them, its
     * centre moved off them — where to look, not where the answers are. Sent by the quest's
     * own page (`GET /game/quests/:id`) only: the lists and the maps have no riddle quests on them
     */
    zone?: QuestZone
    /** Metres from the visitor's point (`lat` / `lon` of the list) to the start, or to the edge of the zone */
    distance?: number
    walk: QuestWalk | null
}

/**
 * A point of a quest as the visitor sees it. The place is sent only once the mode shows it:
 * every point of an open quest, the reached ones of a step quest, the found ones of a riddle or
 * a photo quest.
 */
export interface QuestPoint {
    id: string
    /** From 1 */
    position: number
    state: QuestPointState
    place?: ApiModel.PlaceListItem
    /** What its confirmation gives now; none when counted this season already */
    value?: number
    /** With the place, and with the current riddle */
    hint?: string
    /** The riddle of a photo quest's current point: the first photo of its place, whole (not the place) */
    photo?: { full: string; preview: string; width?: number; height?: number }
    confirmedAt?: string
    /** The editor only (`?edit=1`) */
    hintRu?: string | null
    hintEn?: string | null
}

/** `GET /game/quests/:id` */
export interface QuestResponse extends Quest {
    items: QuestPoint[]
    /** A signed-in visitor's begun quests against the limit: no new one is begun at `max` */
    activeWalks?: { count: number; max: number }
    author?: ApiModel.User
    /** The people who walked it to the end, the latest first */
    walkers: ApiModel.User[]
    /** The editor only (`?edit=1`) */
    titleRu?: string | null
    titleEn?: string | null
    descriptionRu?: string | null
    descriptionEn?: string | null
}

/** A quest on a map (`GET /game/quests/marks`): its start, or a riddle quest's zone centre */
export interface QuestMark {
    id: string
    title: string
    mode: QuestMode
    lat: number
    lon: number
}

export interface QuestMarksResponse {
    items: QuestMark[]
}

/** `GET /game/quests`: a page of the quests — the visitor's own walks first, then the nearest or the newest */
export interface QuestsListRequest {
    limit?: number
    offset?: number
    /** The nearest to this point first (by a quest's first point) */
    lat?: number
    lon?: number
    /**
     * `todo` — not walked to the end yet, `active` — being walked, `idle` — not being walked
     * (never begun or walked), `done` — walked
     */
    walk?: 'todo' | 'active' | 'idle' | 'done'
    mode?: QuestMode
    /** Whose walks are meant: the visitor's by default (a profile's walked quests) */
    user?: string
}

export interface QuestsListResponse {
    items: Quest[]
    count: number
}

export interface QuestGetRequest {
    id: string
    /** Administrators: every point with both locales of the texts */
    edit?: boolean
}

/** `POST /game/quests`, `PATCH /game/quests/:id`: administrators only */
export interface QuestInput {
    titleRu?: string
    titleEn?: string
    descriptionRu?: string
    descriptionEn?: string
    mode?: QuestMode
    status?: QuestStatus
    points?: Array<{ place: string; hintRu?: string | null; hintEn?: string | null }>
}

/** `POST /game/quests/:id/confirm`: "I am here" at a point of the quest */
export interface QuestConfirmRequest {
    id: string
    lat: number
    lon: number
    accuracy?: number
    /** An open quest: the point meant; the nearest one still to confirm without it */
    point?: string
    visitedAt?: string
}

export interface QuestConfirmResponse {
    point: string
    place: string
    /** That was the last point */
    finished: boolean
    /** Season points of the place; 0 when it was counted already */
    points: number
    /** The experience of a walked quest, with the last point */
    bonus: number
    total: number | null
}
