import React, { useMemo } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'

import { ApiModel } from '@/api'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Stable reference: InteractiveMap refits when the options object changes
// maxZoom: places at (nearly) the same point give a zero-size box that would zoom in to the limit
const BOUNDS_OPTIONS = { maxZoom: 15, padding: [32, 32] as [number, number] }

// The main map stops at zoom 6; a list of places may span a whole country or more
const MIN_ZOOM = 3

const isCoordinate = (value: unknown): boolean =>
    (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))

interface PlacesMapProps {
    places?: ApiModel.PlaceMark[]
    /** The places are being fetched: keeps the map's place with a placeholder, so the page does not shift */
    loading?: boolean
}

/**
 * A fixed set of places (a collection, a user's places, bookmarks or visited places) as
 * category markers with the usual place popup, in a framed card. The viewport is fitted
 * to all of them; a single place is centred at a city zoom. Renders nothing without places.
 */
export const PlacesMap: React.FC<PlacesMapProps> = ({ places, loading }) => {
    // Coordinates are numbers in the API types, but guard against decimal strings anyway:
    // `sum + '50.7'` concatenates instead of adding and Leaflet throws on (NaN, NaN).
    // null and '' are skipped before converting, since Number() turns them into 0 (a point off Africa).
    const located = useMemo(
        () =>
            (places ?? [])
                .filter((place) => isCoordinate(place.lat) && isCoordinate(place.lon))
                .map((place) => ({ ...place, lat: Number(place.lat), lon: Number(place.lon) })),
        [places]
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

    if (!located.length) {
        return loading ? (
            <Container className={styles.placesMap}>
                <div className={styles.inner}>
                    <Skeleton style={{ height: '100%', width: '100%' }} />
                </div>
            </Container>
        ) : null
    }

    return (
        <Container className={styles.placesMap}>
            <div className={styles.inner}>
                <InteractiveMap
                    places={located}
                    // A single place has no extent: centre on it; several places: fit them all
                    center={bounds ? undefined : center}
                    zoom={bounds ? undefined : 11}
                    bounds={bounds}
                    boundsOptions={BOUNDS_OPTIONS}
                    minZoom={MIN_ZOOM}
                    scrollWheelZoom={false}
                    controlsSize={'small'}
                    fullMapLink={center ? `/map#${center[0]},${center[1]},10` : undefined}
                    enableFullScreen={false}
                    enableCategoryControl={false}
                    enableLayersSwitcher={false}
                    enableContextMenu={false}
                />
            </div>
        </Container>
    )
}
