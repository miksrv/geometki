import { createContext } from 'react'

import type { LayerStatusStore } from './layers-status/store'

export type { LayerStatus } from './layers-status/store'

interface MapControlsContextValue {
    /** Where an external layer reports what it is doing, read by the layers status panel */
    layerStatuses?: LayerStatusStore
}

export const MapControlsContext = createContext<MapControlsContextValue>({})
