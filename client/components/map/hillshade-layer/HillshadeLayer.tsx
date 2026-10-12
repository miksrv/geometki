import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from '@react-leaflet/core'

import { HillshadeGridLayer, HillshadeGridLayerOptions } from './HillshadeGridLayer'

export const DEFAULT_HILLSHADE_OPACITY = 0.6

// `blankTile=false`: a 404 instead of the "Map data not yet available" picture where there is no data
const HILLSHADE_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/{service}/MapServer/tile/{z}/{y}/{x}?blankTile=false'

// Above the base tiles (200), below the vector shapes and markers (400)
const PANE_Z_INDEX = 250

const HillshadeTiles = createTileLayerComponent<HillshadeGridLayer, HillshadeGridLayerOptions>(
    (options, context) => createElementObject(new HillshadeGridLayer(withPane(options, context)), context),
    updateGridLayer
)

interface HillshadeLayerProps {
    opacity?: number
    // A dark base map: the dark relief is lightened onto it instead of the light one darkened
    dark?: boolean
}

/**
 * Relief shading over any base map. The light relief is white where the ground is flat, so blended
 * with "multiply" it only darkens the slopes and keeps the base map's colours and labels readable
 */
export const HillshadeLayer: React.FC<HillshadeLayerProps> = ({ opacity = DEFAULT_HILLSHADE_OPACITY, dark }) => (
    <ReactLeaflet.Pane
        // The pane's style is set once, on creation: a new pane (and layer) for the other blend mode
        key={dark ? 'dark' : 'light'}
        name={'hillshade'}
        style={{ mixBlendMode: dark ? 'screen' : 'multiply', pointerEvents: 'none', zIndex: PANE_Z_INDEX }}
    >
        <HillshadeTiles
            attribution={'Hillshade &copy; Esri'}
            url={HILLSHADE_URL.replace('{service}', dark ? 'World_Hillshade_Dark' : 'World_Hillshade')}
            opacity={opacity}
            // The best data anywhere: beyond 16 the service has nothing, the 16th tiles are stretched
            maxNativeZoom={16}
            maxZoom={19}
        />
    </ReactLeaflet.Pane>
)
