import Leaflet, { LatLngBounds } from 'leaflet'

import { RequestGetByBounds, ResponseGetImageInfo, WikimediaImageInfo } from '@/api/apiWikimediaCommons'

import { WIKIMEDIA_COMMONS_COLOR } from './constants'

import styles from './styles.module.sass'

export const buildParams = (bounds: LatLngBounds): RequestGetByBounds => ({
    east: bounds.getEast(),
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    west: bounds.getWest()
})

export const cleanTitle = (title: string): string => title.replace(/^File:/, '').replace(/_/g, ' ')

export const createWikimediaIcon = (loading?: boolean): Leaflet.DivIcon => {
    const color = loading ? '#999' : WIKIMEDIA_COMMONS_COLOR

    return Leaflet.divIcon({
        className: styles.wikimediaMarker,
        html: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="8" width="24" height="16" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
            <rect x="10" y="4" width="8" height="5" rx="1" fill="${color}" stroke="white" stroke-width="1.5"/>
            <circle cx="14" cy="16" r="5" fill="white" fill-opacity="0.9"/>
            <circle cx="14" cy="16" r="3" fill="${color}"/>
        </svg>`,
        iconAnchor: [14, 14],
        iconSize: [28, 28]
    })
}

export const extractImageInfo = (data: ResponseGetImageInfo): WikimediaImageInfo | undefined => {
    const pages = data.query.pages
    const firstPage = Object.values(pages)[0]
    return firstPage?.imageinfo?.[0]
}
