import Leaflet, { LatLngBounds } from 'leaflet'

import { RequestGetByBounds, ResponseGetExtract, WikipediaArticle } from '@/api/apiWikipedia'

import { WIKIPEDIA_BASE_DOMAIN, WIKIPEDIA_COLOR } from './constants'

import styles from './styles.module.sass'

export const buildParams = (bounds: LatLngBounds, locale: string): RequestGetByBounds => ({
    east: bounds.getEast(),
    locale,
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    west: bounds.getWest()
})

export const extractArticle = (data: ResponseGetExtract): WikipediaArticle | undefined => {
    const pages = data.query.pages
    const firstPage = Object.values(pages)[0]
    return firstPage
}

export const truncateExtract = (text: string, maxChars: number): string => {
    if (text.length <= maxChars) {
        return text
    }
    return text.slice(0, maxChars) + '…'
}

export const createWikipediaIcon = (loading?: boolean): Leaflet.DivIcon => {
    const color = loading ? '#999' : WIKIPEDIA_COLOR

    return Leaflet.divIcon({
        className: styles.wikipediaMarker,
        // Same look as the category icons: a rounded square with a white glyph (the "W" letter here)
        html: `<svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" rx="14" fill="${color}"/>
            <polyline points="22,36 44,94 64,52 84,94 106,36" fill="none" stroke="white" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        iconAnchor: [10, 10],
        iconSize: [20, 20]
    })
}

export const articleUrl = (title: string, locale: string): string =>
    `https://${locale}.${WIKIPEDIA_BASE_DOMAIN}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
