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
        html: `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="20" height="22" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
            <rect x="7" y="9" width="14" height="1.5" rx="0.75" fill="white"/>
            <rect x="7" y="13" width="14" height="1.5" rx="0.75" fill="white"/>
            <rect x="7" y="17" width="10" height="1.5" rx="0.75" fill="white"/>
        </svg>`,
        iconAnchor: [14, 14],
        iconSize: [28, 28]
    })
}

export const articleUrl = (title: string, locale: string): string =>
    `https://${locale}.${WIKIPEDIA_BASE_DOMAIN}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
