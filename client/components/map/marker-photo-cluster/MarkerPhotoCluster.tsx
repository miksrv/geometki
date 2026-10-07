import React from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel, ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

interface MarkerPhotoClusterProps {
    marker: ApiModel.PhotoMark
    onClick?: (coords: ApiType.Coordinates) => void
}

const MarkerPhotoClusterComponent: React.FC<MarkerPhotoClusterProps> = ({ marker, onClick }) => {
    const clusterMarkerIcon = new Leaflet.DivIcon({
        className: styles.markerPhotoCluster,
        html:
            '<img src="' +
            IMG_HOST +
            marker.preview +
            '" alt="" loading="lazy" /><div class="map-placemark-cluster-count">' +
            marker.count +
            '</div></div>'
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
export const MarkerPhotoCluster = React.memo(MarkerPhotoClusterComponent)
