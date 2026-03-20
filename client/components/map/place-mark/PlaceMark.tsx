'use client'

import React from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiType } from '@/api'
import { convertDMS } from '@/utils/coordinates'

import styles from './styles.module.sass'

interface PlaceMarkProps extends ApiType.Coordinates {
    onClick?: () => void
}

export const PlaceMark: React.FC<PlaceMarkProps> = ({ lat, lon, onClick }) => {
    const placeMarkerIcon = new Leaflet.DivIcon({
        className: styles.placeMark,
        html: '<div>' + convertDMS(lat, lon) + '</div>'
    })

    return (
        <Marker
            position={[lat, lon]}
            icon={placeMarkerIcon}
            eventHandlers={{
                click: onClick
            }}
        />
    )
}
