import React, { useMemo } from 'react'

import dynamic from 'next/dynamic'

import { ApiModel, ApiType } from '@/api'
import { MarkerPinData } from '@/components/map/types'

import { computeMapView } from './utils'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Stable reference: the map refits when this object changes
const BOUNDS_OPTIONS = { padding: [32, 32] as [number, number] }

export interface SearchMapProps {
    places?: ApiModel.Place[]
    locations?: ApiModel.GeoSearchLocation[]
    coordinates?: ApiType.Search.Response['coordinates']
}

export const SearchMap: React.FC<SearchMapProps> = ({ places, locations, coordinates }) => {
    const placeMarks = useMemo<ApiModel.PlaceMark[]>(
        () =>
            places
                ?.filter((p): p is ApiModel.Place & { lat: number; lon: number } => p.lat != null && p.lon != null)
                .map((p) => ({
                    id: p.id,
                    category: p.category?.name as ApiModel.Categories,
                    lat: p.lat,
                    lon: p.lon
                })) ?? [],
        [places]
    )

    const pins = useMemo<MarkerPinData[]>(() => {
        const result: MarkerPinData[] = []

        locations?.forEach((loc) => {
            if (loc.lat == null || loc.lon == null) {
                return
            }

            const parts = [loc.locality, loc.district, loc.region, loc.country].filter(Boolean)

            result.push({
                lat: loc.lat,
                lon: loc.lon,
                type: 'location',
                label: parts.join(', ') || undefined
            })
        })

        if (coordinates) {
            result.push({
                lat: coordinates.lat,
                lon: coordinates.lon,
                type: 'coordinates',
                label: coordinates.secondary ?? `${coordinates.lat}, ${coordinates.lon}`
            })
        }

        return result
    }, [locations, coordinates])

    const { center, zoom, bounds } = useMemo(() => {
        const points = [
            ...(places
                ?.filter((p): p is ApiModel.Place & { lat: number; lon: number } => p.lat != null && p.lon != null)
                .map((p) => ({ lat: p.lat, lon: p.lon })) ?? []),
            ...(locations?.filter((l) => l.lat != null && l.lon != null).map((l) => ({ lat: l.lat!, lon: l.lon! })) ??
                []),
            ...(coordinates ? [{ lat: coordinates.lat, lon: coordinates.lon }] : [])
        ]

        return computeMapView(points)
    }, [places, locations, coordinates])

    return (
        <InteractiveMap
            // Several results: fit them all; one or none: centre and zoom
            center={bounds ? undefined : center}
            zoom={bounds ? undefined : zoom}
            bounds={bounds}
            boundsOptions={BOUNDS_OPTIONS}
            minZoom={2}
            places={placeMarks}
            pins={pins}
            scrollWheelZoom={true}
            controlsSize={'small'}
        />
    )
}
