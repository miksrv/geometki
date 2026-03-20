export enum MapObjectsTypeEnum {
    PHOTOS = 'Photos',
    PLACES = 'Places'
}

export enum MapLayersEnum {
    GOOGLE_MAP = 'GoogleMap',
    GOOGLE_SAT = 'GoogleSat',
    MAPBOX = 'MapBox',
    MAPBOX_SAT = 'MapBoxSat',
    OCM = 'OCM',
    OSM = 'OSM'
}

export enum MapAdditionalLayersEnum {
    HEATMAP = 'Heatmap',
    HISTORICAL_PHOTOS = 'HistoricalPhotos'
}

export type MapPositionType = {
    lat: number
    lon: number
    zoom?: number
}
