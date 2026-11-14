import { ApiModel } from '@/api'

export enum MapObjectsTypeEnum {
    PHOTOS = 'Photos',
    PLACES = 'Places'
}

export enum MapLayersEnum {
    CARTO_DARK = 'CartoDark',
    CARTO_LIGHT = 'CartoLight',
    ESRI_SAT = 'ESRISat',
    GOOGLE_MAP = 'GoogleMap',
    GOOGLE_SAT = 'GoogleSat',
    MAPBOX = 'MapBox',
    MAPBOX_SAT = 'MapBoxSat',
    OCM = 'OCM',
    OPEN_TOPO = 'OpenTopo',
    OSM = 'OSM',
    YANDEX_SAT = 'YandexSat'
}

// The order of the checkboxes in the layers panel: the site's own quests first
export enum MapAdditionalLayersEnum {
    QUESTS = 'Quests',
    HISTORICAL_PHOTOS = 'HistoricalPhotos',
    WIKIMEDIA_COMMONS = 'WikimediaCommons',
    WIKIPEDIA = 'Wikipedia'
}

// Waymarked Trails overlays: the value is the tile set's name in the tile URL
export enum MapTrailsLayerEnum {
    HIKING = 'hiking',
    CYCLING = 'cycling',
    SLOPES = 'slopes'
}

export type MapPositionType = {
    lat: number
    lon: number
    zoom?: number
}

export type MarkerPinType = 'location' | 'coordinates'

export interface MarkerPinData {
    lat: number
    lon: number
    type: MarkerPinType
    label?: string
}

/** A point of a quest of the game on a map (`QuestLayer`): only the points the walker has opened */
/** The search zone of a riddle quest on a map: a dashed circle */
export interface QuestZoneMark {
    id: string
    lat: number
    lon: number
    /** Metres */
    radius: number
}

export interface QuestPointMark {
    id: string
    lat: number
    lon: number
    /** The number of the point in the quest */
    label: string
    state: 'done' | 'current' | 'open'
    /** The place's name, in the hint */
    title?: string
    /** The place's category: a confirmed point is drawn as the site's mark of it */
    category?: ApiModel.Categories
}
