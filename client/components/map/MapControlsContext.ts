import { createContext } from 'react'

import { MapAdditionalLayersEnum } from './types'

export interface LayerStatus {
    loading: boolean
    error?: boolean
    /** Objects of the layer in the visible area */
    count: number
    /** The source has more objects in the area than it returned */
    limited?: boolean
}

interface MapControlsContextValue {
    /**
     * Place for a layer's panel in the bottom-left corner, above the cursor coordinates:
     * the panel gets the same left offset, gap and width as the coordinates readout
     */
    bottomSlot: HTMLElement | null
    /** An external layer reports what it is doing, `undefined` once it is turned off */
    reportLayerStatus?: (layer: MapAdditionalLayersEnum, status?: LayerStatus) => void
}

export const MapControlsContext = createContext<MapControlsContextValue>({ bottomSlot: null })
