import { useSyncExternalStore } from 'react'

import { MapAdditionalLayersEnum } from '../types'

export interface LayerStatus {
    loading: boolean
    error?: boolean
    /** Objects of the layer in the visible area */
    count: number
    /** The source has more objects in the area than it returned */
    limited?: boolean
    /** The visible area is bigger than the source takes, nothing was asked */
    tooLarge?: boolean
}

export type LayerStatuses = Partial<Record<MapAdditionalLayersEnum, LayerStatus>>

/**
 * Statuses of the external layers, outside of the React state of the map: a layer reports
 * on every load, and only the status panel re-renders, not the map with all its markers
 */
export interface LayerStatusStore {
    get: () => LayerStatuses
    /** `undefined` once the layer is turned off */
    set: (layer: MapAdditionalLayersEnum, status?: LayerStatus) => void
    subscribe: (listener: () => void) => () => void
}

export const createLayerStatusStore = (): LayerStatusStore => {
    let statuses: LayerStatuses = {}
    const listeners = new Set<() => void>()

    return {
        get: () => statuses,
        set: (layer, status) => {
            statuses = { ...statuses, [layer]: status }
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener) => {
            listeners.add(listener)

            return () => listeners.delete(listener)
        }
    }
}

const EMPTY: LayerStatuses = {}
const noStore: LayerStatusStore = { get: () => EMPTY, set: () => undefined, subscribe: () => () => undefined }

/** The current statuses, re-rendering the caller on every report */
export const useLayerStatuses = (store: LayerStatusStore = noStore): LayerStatuses =>
    useSyncExternalStore(store.subscribe, store.get, store.get)
