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

export enum MapAdditionalLayersEnum {
    HEATMAP = 'Heatmap',
    HISTORICAL_PHOTOS = 'HistoricalPhotos',
    WIKIMEDIA_COMMONS = 'WikimediaCommons'
}

export type MapPositionType = {
    lat: number
    lon: number
    zoom?: number
}
