import React, { useEffect, useRef, useState } from 'react'

import { ApiModel } from '@/api'
import { PlacesMap } from '@/components/shared/places-map'

interface LandingMapPreviewProps {
    places?: ApiModel.PlaceListItem[]
    /** Appended before the `#lat,lon,zoom` hash of the "Открыть на большой карте" link, e.g. `?category=cave` — see `pages/map.tsx` */
    fullMapQuery?: string
}

/**
 * The compact map block of a location/pair landing page (features/20-location-seo-pages.md,
 * "Шаблон страницы → Карта"): Leaflet is only loaded once the block scrolls into view, so it
 * never costs anything on the mobile first screen. Renders nothing without placed places —
 * same as `PlacesMap`, which it wraps once visible.
 */
export const LandingMapPreview: React.FC<LandingMapPreviewProps> = ({ places, fullMapQuery }) => {
    const [visible, setVisible] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (visible) {
            return
        }

        const el = rootRef.current
        if (!el) {
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                }
            },
            { rootMargin: '200px 0px' }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [visible])

    const markers: ApiModel.PlaceMark[] | undefined = places
        ?.filter((place) => place.lat && place.lon && place.category)
        .map((place) => ({
            category: place.category?.name as ApiModel.Categories,
            id: place.id,
            lat: place.lat,
            lon: place.lon,
            type: 'point'
        }))

    return (
        <div
            ref={rootRef}
            data-testid={'landing-map-preview'}
        >
            {visible && !!markers?.length && (
                <PlacesMap
                    places={markers}
                    compact={true}
                    fullMapQuery={fullMapQuery}
                />
            )}
        </div>
    )
}
