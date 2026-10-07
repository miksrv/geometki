import React from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel, ApiType } from '@/api'

import styles from './styles.module.sass'

interface MarkerPointClusterProps {
    marker: ApiModel.PlaceMark | ApiModel.PhotoMark
    onClick?: (coords: ApiType.Coordinates) => void
}

const MarkerPointClusterComponent: React.FC<MarkerPointClusterProps> = ({ marker, onClick }) => {
    const clusterMarkerIcon = new Leaflet.DivIcon({
        className: styles.mapPointCluster,
        html: '<div>' + marker.count + '</div>'
    })

    return (
        <Marker
            position={[marker.lat, marker.lon]}
            icon={clusterMarkerIcon}
            eventHandlers={{
                click: () => onClick?.({ lat: marker.lat, lon: marker.lon })
            }}
        />
    )
}

/** Memoized: markers don't re-render just because the map's own state changed. */
export const MarkerPointCluster = React.memo(MarkerPointClusterComponent)
