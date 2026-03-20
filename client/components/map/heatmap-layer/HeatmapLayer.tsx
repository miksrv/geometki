'use client'

import React, { useEffect, useRef } from 'react'
import * as ReactLeaflet from 'react-leaflet'
import L from 'leaflet'

import { API } from '@/api'

import 'leaflet.heat'

export const HeatmapLayer: React.FC = () => {
    const map = ReactLeaflet.useMap()
    const heatmapLayerRef = useRef(null)

    const { data: usersData } = API.usePoiGetUsersQuery()

    useEffect(() => {
        if (usersData?.items && usersData.items.length > 0 && !heatmapLayerRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            heatmapLayerRef.current = (L as any)
                .heatLayer(usersData.items, {
                    gradient: { 0.1: '#2688eb', 0.5: '#4bb34b', 1: '#e64646' },
                    max: 1,
                    minOpacity: 0.3
                })
                .addTo(map)
        } else if (heatmapLayerRef.current && (!usersData?.items || usersData.items.length === 0)) {
            map.removeLayer(heatmapLayerRef.current)
            heatmapLayerRef.current = null
        }

        return () => {
            if (heatmapLayerRef.current) {
                map.removeLayer(heatmapLayerRef.current)
                heatmapLayerRef.current = null
            }
        }
    }, [map, usersData?.items])

    return null
}
