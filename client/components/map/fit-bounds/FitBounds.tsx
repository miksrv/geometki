import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet'

interface FitBoundsProps {
    bounds?: LatLngBoundsExpression
    options?: FitBoundsOptions
}

/**
 * Fits the map viewport to `bounds` once the map exists and again whenever the bounds
 * change (e.g. places added to a collection). Lives inside MapContainer because the map
 * instance is only available to children (`useMap`) — a parent ref is still null during
 * the parent's own mount effects.
 */
export const FitBounds: React.FC<FitBoundsProps> = ({ bounds, options }) => {
    const map = useMap()

    useEffect(() => {
        if (bounds) {
            // The container may have just been laid out — make Leaflet re-measure it first
            map.invalidateSize()
            map.fitBounds(bounds, options)
        }
    }, [map, bounds, options])

    return null
}
