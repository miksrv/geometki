import { useContext, useEffect } from 'react'

import { LayerStatus, MapControlsContext } from '../MapControlsContext'
import { MapAdditionalLayersEnum } from '../types'

/** Sends the layer's loading state and objects count to the map's layers status panel */
export const useReportLayerStatus = (
    layer: MapAdditionalLayersEnum,
    { loading, error, count, limited }: LayerStatus
) => {
    const { reportLayerStatus } = useContext(MapControlsContext)

    useEffect(() => {
        reportLayerStatus?.(layer, { count, error, limited, loading })
    }, [reportLayerStatus, layer, loading, error, count, limited])

    useEffect(() => () => reportLayerStatus?.(layer, undefined), [reportLayerStatus, layer])
}
