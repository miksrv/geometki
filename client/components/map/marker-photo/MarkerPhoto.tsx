import React, { useMemo } from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

interface MarkerPhotoProps {
    photo: ApiModel.PhotoMark
    /** This marker's position in the parent's photo list, passed back to `onPhotoClick` as-is */
    index?: number
    onPhotoClick?: (index?: number) => void
}

export const MarkerPhotoComponent: React.FC<MarkerPhotoProps> = ({ photo, index, onPhotoClick }) => {
    const photoMarkerIcon = useMemo(
        () =>
            new Leaflet.Icon({
                className: styles.markerPhoto,
                iconAnchor: [16, 16],
                iconSize: [32, 32],
                iconUrl: `${IMG_HOST}${photo.preview}`
            }),
        [photo.preview]
    )

    return (
        <Marker
            position={[photo.lat, photo.lon]}
            icon={photoMarkerIcon}
            title={photo.title}
            alt={photo.title}
            eventHandlers={{
                click: () => {
                    onPhotoClick?.(index)
                }
            }}
        />
    )
}

/** Memoized: markers don't re-render just because the map's own state changed. */
export const MarkerPhoto = React.memo(MarkerPhotoComponent)
