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
        // Same look as the category icons: a rounded square with a white glyph (a camera here)
        html: `<svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" rx="14" fill="${color}"/>
            <rect x="48" y="30" width="32" height="18" rx="4" fill="white"/>
            <rect x="22" y="42" width="84" height="58" rx="8" fill="white"/>
            <circle cx="64" cy="71" r="19" fill="${color}"/>
            <circle cx="64" cy="71" r="10" fill="white"/>
        </svg>`,
        iconAnchor: [10, 10],
        iconSize: [20, 20]
    })
}

export const extractImageInfo = (data: ResponseGetImageInfo): WikimediaImageInfo | undefined => {
    const pages = data.query.pages
    const firstPage = Object.values(pages)[0]
    return firstPage?.imageinfo?.[0]
}
