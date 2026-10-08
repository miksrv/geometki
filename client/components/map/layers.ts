import { CYCLEMAP_TOKEN, MAPBOX_TOKEN } from '@/config/env'

import { MapLayersEnum } from './types'

// These tile servers need a key: without it the layer is not offered (Leaflet even throws on a missing {accessToken})
const LAYER_TOKENS: Partial<Record<MapLayersEnum, string | undefined>> = {
    [MapLayersEnum.MAPBOX]: MAPBOX_TOKEN,
    [MapLayersEnum.MAPBOX_SAT]: MAPBOX_TOKEN,
    [MapLayersEnum.OCM]: CYCLEMAP_TOKEN
}

export const isMapLayerAvailable = (layer: MapLayersEnum): boolean => !(layer in LAYER_TOKENS) || !!LAYER_TOKENS[layer]

/** The base layers that can be shown in this environment */
export const AVAILABLE_MAP_LAYERS = Object.values(MapLayersEnum).filter(isMapLayerAvailable)
