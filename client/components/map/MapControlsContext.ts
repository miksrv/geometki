import { createContext } from 'react'

import type { LayerStatusStore } from './layers-status/store'

export type { LayerStatus } from './layers-status/store'

interface MapControlsContextValue {
    /**
     * Place for a layer's panel in the bottom-left corner, above the cursor coordinates:
     * the panel gets the same left offset, gap and width as the coordinates readout
     */
    bottomSlot: HTMLElement | null
    /** Where an external layer reports what it is doing, read by the layers status panel */
    layerStatuses?: LayerStatusStore
}

export const MapControlsContext = createContext<MapControlsContextValue>({ bottomSlot: null })
