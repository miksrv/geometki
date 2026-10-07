import React, { useMemo } from 'react'

import dynamic from 'next/dynamic'

import { ApiModel } from '@/api'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Stable reference: InteractiveMap refits when the options object changes
const BOUNDS_OPTIONS = { padding: [32, 32] as [number, number] }

interface CollectionMapPlace {
    id: string
    lat: number
    lon: number
    category?: ApiModel.Category
}

interface CollectionMapProps {
    places: CollectionMapPlace[]
}

/**
 * Collection map: the places as category markers with the usual place popup (the same
 * `places` layer as the main map), viewport fitted to all of them. Fills its parent —
 * the caller sets the height.
 */
export const CollectionMap: React.FC<CollectionMapProps> = ({ places }) => {
    // Coordinates are numbers in the API types, but guard against decimal strings anyway:
    // `sum + '50.7'` concatenates instead of adding and Leaflet throws on (NaN, NaN).
    const located = useMemo(
        () =>
            places
                .map((place) => ({ ...place, lat: Number(place.lat), lon: Number(place.lon) }))
                .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon)),
        [places]
    )

    const placeMarks = useMemo<ApiModel.PlaceMark[]>(
        () =>
            located.map((place) => ({
                id: place.id,
                lat: place.lat,
                lon: place.lon,
                category: place.category?.name as ApiModel.Categories
            })),
        [located]
    )

    const { center, bounds } = useMemo(() => {
        if (!located.length) {
            return { bounds: undefined, center: undefined }
        }

        const lats = located.map((place) => place.lat)
        const lons = located.map((place) => place.lon)
        const center: [number, number] = [
            lats.reduce((sum, value) => sum + value, 0) / located.length,
            lons.reduce((sum, value) => sum + value, 0) / located.length
        ]

        // A single place has no extent to fit — keep the default zoom around it
        const bounds: [[number, number], [number, number]] | undefined =
            located.length > 1
                ? [
                      [Math.min(...lats), Math.min(...lons)],
                      [Math.max(...lats), Math.max(...lons)]
                  ]
                : undefined

        return { bounds, center }
    }, [located])

    return (
        <InteractiveMap
            places={placeMarks}
            // A single place has no extent: centre on it; several places: fit them all
            center={bounds ? undefined : center}
            zoom={bounds ? undefined : center ? 11 : undefined}
            bounds={bounds}
            boundsOptions={BOUNDS_OPTIONS}
            scrollWheelZoom={false}
            controlsSize={'small'}
            fullMapLink={center ? `/map#${center[0]},${center[1]},10` : undefined}
            enableFullScreen={false}
            enableCategoryControl={false}
            enableLayersSwitcher={false}
            enableContextMenu={false}
        />
    )
}
