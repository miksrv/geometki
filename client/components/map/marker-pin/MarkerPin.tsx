import React, { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import Leaflet from 'leaflet'

import { MarkerPinData, MarkerPinType } from '../types'

import styles from './styles.module.sass'

const PIN_CONFIG: Record<MarkerPinType, { color: string; path: string }> = {
    location: {
        color: '#2688eb',
        // PinDrop icon path
        path: 'M18 8c0-3.31-2.69-6-6-6S6 4.69 6 8c0 4.5 6 11 6 11s6-6.5 6-11m-8 0c0-1.1.9-2 2-2s2 .9 2 2-.89 2-2 2c-1.1 0-2-.9-2-2M5 20v2h14v-2z'
    },
    coordinates: {
        color: '#F8A01C',
        // Position (crosshair) icon path
        path: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'
    }
}

interface MarkerPinProps {
    pin: MarkerPinData
}

export const MarkerPin: React.FC<MarkerPinProps> = ({ pin }) => {
    const { color, path } = PIN_CONFIG[pin.type]

    const icon = useMemo(
        () =>
            new Leaflet.DivIcon({
                className: '',
                iconAnchor: [12, 12],
                iconSize: [24, 24],
                html: `<div style="width:24px;height:24px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff"><svg viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="${path}"/></svg></div>`
            }),
        [color, path]
    )

    return (
        <Marker
            position={[pin.lat, pin.lon]}
            icon={icon}
        >
            {pin.label && (
                <Popup className={styles.markerPinPopup}>
                    <span>{pin.label}</span>
                </Popup>
            )}
        </Marker>
    )
}
