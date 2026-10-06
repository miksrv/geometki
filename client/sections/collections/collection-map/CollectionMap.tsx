import React, { useMemo } from 'react'

import dynamic from 'next/dynamic'

import { MarkerPinData } from '@/components/map/types'

import styles from '../styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

interface CollectionMapPlace {
    id: string
    lat: number
    lon: number
    title?: string
}

interface CollectionMapProps {
    places: CollectionMapPlace[]
}

/**
 * Collection page map: all places as numbered markers matching the list order below.
 * Must be dynamically imported with `ssr: false` by the caller — InteractiveMap needs `window`.
 */
export const CollectionMap: React.FC<CollectionMapProps> = ({ places }) => {
    const pins = useMemo<MarkerPinData[]>(
        () =>
            places.map((place, index) => ({
                lat: place.lat,
                lon: place.lon,
                label: place.title,
                number: index + 1,
                type: 'location'
            })),
        [places]
    )

    const center = useMemo(() => {
        if (!places.length) {
            return undefined
        }

        const lat = places.reduce((sum, place) => sum + place.lat, 0) / places.length
        const lon = places.reduce((sum, place) => sum + place.lon, 0) / places.length

        return { lat, lon }
    }, [places])

    return (
        <div className={styles.mapWrap}>
            <InteractiveMap
                pins={pins}
                center={center ? [center.lat, center.lon] : undefined}
                enableCategoryControl={false}
                enableLayersSwitcher={false}
                enableContextMenu={false}
            />
        </div>
    )
}
