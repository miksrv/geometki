import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { MapTrailsLayerEnum } from '../types'

const TRAILS_URL = 'https://tile.waymarkedtrails.org/{trails}/{z}/{x}/{y}.png'

const TRAILS_ATTRIBUTION =
    'Trails &copy; <a href="https://waymarkedtrails.org" target="_blank" rel="noreferrer">Waymarked Trails</a> (CC BY-SA)'

// Above the base tiles (200) and the hillshade (250), below the vector shapes and markers (400)
const PANE_Z_INDEX = 260

interface TrailsLayerProps {
    trails: MapTrailsLayerEnum[]
}

/**
 * Marked hiking, cycling and ski routes from OpenStreetMap relations, drawn by Waymarked Trails as
 * transparent tiles over any base map
 */
export const TrailsLayer: React.FC<TrailsLayerProps> = ({ trails }) => (
    <ReactLeaflet.Pane
        name={'trails'}
        style={{ pointerEvents: 'none', zIndex: PANE_Z_INDEX }}
    >
        {trails.map((type) => (
            <ReactLeaflet.TileLayer
                key={type}
                attribution={TRAILS_ATTRIBUTION}
                url={TRAILS_URL.replace('{trails}', type)}
                // Small zooms show nothing useful and load the service for nothing
                minZoom={6}
                maxNativeZoom={18}
                maxZoom={19}
            />
        ))}
    </ReactLeaflet.Pane>
)
