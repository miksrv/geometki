'use client'

import React from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

interface MarkerPhotoProps {
    photo: ApiModel.PhotoMark
    onPhotoClick?: (photos?: ApiModel.PhotoMark[], index?: number) => void
}

export const MarkerPhoto: React.FC<MarkerPhotoProps> = ({ photo, onPhotoClick }) => {
    const photoMarkerIcon = new Leaflet.Icon({
        className: styles.markerPhoto,
        iconAnchor: [16, 16],
        iconSize: [32, 32],
        iconUrl: `${IMG_HOST}${photo.preview}`
    })

    return (
        <Marker
            position={[photo.lat, photo.lon]}
            icon={photoMarkerIcon}
            title={photo.title}
            alt={photo.title}
            eventHandlers={{
                click: () => {
                    onPhotoClick?.([])
                }
            }}
        />
    )
}
