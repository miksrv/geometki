import { useContext, useEffect } from 'react'

import { MapControlsContext } from '../MapControlsContext'
import { MapAdditionalLayersEnum } from '../types'

import { LayerStatus } from './store'

/** Sends the layer's loading state and objects count to the map's layers status panel */
export const useReportLayerStatus = (
    layer: MapAdditionalLayersEnum,
    { loading, error, count, limited, tooLarge }: LayerStatus
) => {
    const { layerStatuses } = useContext(MapControlsContext)

    useEffect(() => {
        layerStatuses?.set(layer, { count, error, limited, loading, tooLarge })
    }, [layerStatuses, layer, loading, error, count, limited, tooLarge])

    useEffect(() => () => layerStatuses?.set(layer, undefined), [layerStatuses, layer])
}
