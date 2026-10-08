import { ApiModel } from '@/api'
import { LOCAL_STORAGE } from '@/config/constants'
import * as LocalStorage from '@/utils/localstorage'

import { isMapLayerAvailable } from './layers'
import { MapAdditionalLayersEnum, MapLayersEnum, MapObjectsTypeEnum, MapPositionType } from './types'

/** The user's map choices kept between visits of the map page */
export type MapSettings = {
    position?: MapPositionType
    layer?: MapLayersEnum
    type?: MapObjectsTypeEnum
    additionalLayers?: MapAdditionalLayersEnum[]
    categories?: ApiModel.Categories[]
    osmCandidatesCollapsed?: boolean
}

const STORAGE_KEY = LOCAL_STORAGE.MAP_SETTINGS as 'MAP_SETTINGS'
// The position used to be kept on its own: read once as a fallback, removed on the next save
const LEGACY_POSITION_KEY = LOCAL_STORAGE.MAP_CENTER as 'MAP_CENTER'

const isOneOf = <T extends string>(values: Record<string, T>, value: unknown): value is T =>
    Object.values(values).includes(value as T)

// Unknown values are dropped: layers and categories may have been removed since they were saved.
// An empty list (nothing selected, or removed values only) is treated as not saved: the map opens
// with its default, every category, rather than empty with no hint why
const onlyKnown = <T extends string>(values: Record<string, T>, list: unknown): T[] | undefined => {
    if (!Array.isArray(list)) {
        return
    }

    const known = [...new Set(list.filter((value): value is T => isOneOf(values, value)))]

    return known.length ? known : undefined
}

const toPosition = (value: unknown): MapPositionType | undefined => {
    if (!value || typeof value !== 'object') {
        return
    }

    const { lat, lon, zoom } = value as Record<string, unknown>
    const isCoordinate = (coordinate: unknown, limit: number): coordinate is number =>
        typeof coordinate === 'number' && Number.isFinite(coordinate) && Math.abs(coordinate) <= limit

    if (!isCoordinate(lat, 90) || !isCoordinate(lon, 180)) {
        return
    }

    return { lat, lon, zoom: typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : undefined }
}

// localStorage throws when it is blocked (private mode, site data off) or full: the map works without it
const safely = <T>(action: () => T, fallback: T): T => {
    try {
        return action()
    } catch {
        return fallback
    }
}

const readMapSettings = (): MapSettings => {
    const stored = LocalStorage.getItem(STORAGE_KEY) as unknown
    const legacyPosition = toPosition(LocalStorage.getItem(LEGACY_POSITION_KEY))

    if (!stored || typeof stored !== 'object') {
        return { position: legacyPosition }
    }

    const { position, layer, type, additionalLayers, categories, osmCandidatesCollapsed } = stored as Record<
        string,
        unknown
    >

    return {
        position: toPosition(position) ?? legacyPosition,
        additionalLayers: onlyKnown(MapAdditionalLayersEnum, additionalLayers),
        categories: onlyKnown(ApiModel.Categories, categories),
        // A layer saved where its key was set (e.g. production) may be unavailable here
        layer: isOneOf(MapLayersEnum, layer) && isMapLayerAvailable(layer) ? layer : undefined,
        osmCandidatesCollapsed: typeof osmCandidatesCollapsed === 'boolean' ? osmCandidatesCollapsed : undefined,
        type: isOneOf(MapObjectsTypeEnum, type) ? type : undefined
    }
}

/** Saved settings, validated: a missing or broken value is undefined, so the caller uses its default */
export const getMapSettings = (): MapSettings => safely(readMapSettings, {})

/** Merges the changed settings into the saved ones */
export const saveMapSettings = (settings: MapSettings) =>
    safely(() => {
        LocalStorage.setItem(STORAGE_KEY, { ...readMapSettings(), ...settings })

        if (LocalStorage.getItem(LEGACY_POSITION_KEY)) {
            LocalStorage.removeItem(LEGACY_POSITION_KEY)
        }
    }, undefined)
