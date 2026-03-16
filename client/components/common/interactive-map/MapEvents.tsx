import React, { useEffect } from 'react'
import * as ReactLeaflet from 'react-leaflet'
import { LatLngBounds } from 'leaflet'

import { ApiType } from '@/api'
import { round } from '@/functions/helpers'

interface MapEventsProps {
    onMouseMove?: (coordinates: ApiType.Coordinates) => void
    onChangeBounds?: (bounds: LatLngBounds, zoom: number) => void
}

export const MapEvents: React.FC<MapEventsProps> = ({ onMouseMove, onChangeBounds }) => {
    const mapEvents = ReactLeaflet.useMapEvents({
        mousedown: () => {
            mapEvents.closePopup()
        },
        mousemove: (event) => {
            onMouseMove?.({
                lat: round(event.latlng.lat, 5) || 0,
                lon: round(event.latlng.lng, 5) || 0
            })
        },
        moveend: () => {
            onChangeBounds?.(mapEvents.getBounds(), mapEvents.getZoom())
        }
    })

    useEffect(() => {
        onChangeBounds?.(mapEvents.getBounds(), mapEvents.getZoom())
    }, [mapEvents])

    return null
}
