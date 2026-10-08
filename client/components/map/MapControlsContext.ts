import { createContext } from 'react'

interface MapControlsContextValue {
    /**
     * Place for a layer's panel in the bottom-left corner, above the cursor coordinates:
     * the panel gets the same left offset, gap and width as the coordinates readout
     */
    bottomSlot: HTMLElement | null
}

export const MapControlsContext = createContext<MapControlsContextValue>({ bottomSlot: null })
