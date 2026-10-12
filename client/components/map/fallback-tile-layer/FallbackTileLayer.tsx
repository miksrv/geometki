import {
    createElementObject,
    createTileLayerComponent,
    LayerProps,
    updateGridLayer,
    withPane
} from '@react-leaflet/core'

import { FallbackGridLayer, FallbackGridLayerOptions } from './FallbackGridLayer'

/** Like react-leaflet's TileLayer, with the missing tiles taken from the levels above */
export const FallbackTileLayer = createTileLayerComponent<FallbackGridLayer, FallbackGridLayerOptions & LayerProps>(
    (options, context) => createElementObject(new FallbackGridLayer(withPane(options, context)), context),
    (layer, props, prevProps) => {
        updateGridLayer(layer, props, prevProps)

        if (props.url !== prevProps.url) {
            layer.setUrl(props.url)
        }
    }
)
