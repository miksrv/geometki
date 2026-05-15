import Leaflet, { LatLngBounds } from 'leaflet'

import { ApiModel } from '@/api'
import { PastvuPhoto, RequestGetByBounds } from '@/api/apiPastvu'

import { DIR_TO_DEGREES, IMG_HOST, MAX_YEAR, MIN_YEAR } from './constants'

import styles from './styles.module.sass'

export const buildParams = (bounds: LatLngBounds, zoom: number): RequestGetByBounds => ({
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [bounds.getWest(), bounds.getSouth()],
                [bounds.getEast(), bounds.getSouth()],
                [bounds.getEast(), bounds.getNorth()],
                [bounds.getWest(), bounds.getNorth()],
                [bounds.getWest(), bounds.getSouth()]
            ]
        ]
    },
    z: zoom
})

export const photoToMark = (photo: PastvuPhoto): ApiModel.PhotoMark => ({
    full: `${IMG_HOST}/a/${photo.file}`,
    lat: photo.geo[0],
    lon: photo.geo[1],
    preview: `${IMG_HOST}/h/${photo.file}`,
    title: `${photo.title ?? ''}${photo.year ? ` (${photo.year})` : ''}`
})

export const yearToColor = (year?: number): string => {
    const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year ?? MIN_YEAR))
    const ratio = (clamped - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)
    const hue = Math.round(240 - ratio * 120)
    return `hsl(${hue}, 75%, 50%)`
}

export const createDirectionIcon = (dir?: string, year?: number): Leaflet.DivIcon => {
    const degrees = dir ? (DIR_TO_DEGREES[dir.toLowerCase()] ?? undefined) : undefined
    const hasDir = degrees !== undefined
    const color = yearToColor(year)

    return Leaflet.divIcon({
        className: styles.pastuvMarker,
        html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            ${hasDir ? `<g transform="rotate(${degrees}, 16, 16)"><polygon points="16,2 12,14 20,14" fill="${color}" fill-opacity="0.9" stroke="white" stroke-width="1"/></g>` : ''}
            <circle cx="16" cy="16" r="5" fill="${color}" stroke="white" stroke-width="1.5"/>
        </svg>`,
        iconAnchor: [16, 16],
        iconSize: [32, 32]
    })
}

export const createThumbnailIcon = (file: string, year?: number): Leaflet.DivIcon =>
    Leaflet.divIcon({
        className: styles.pastuvMarker,
        html: `<img src="${IMG_HOST}/h/${file}" class="${styles.historicalPhoto}" style="border-color:${yearToColor(year)}" />`,
        iconAnchor: [25, 16],
        iconSize: [50, 32]
    })

export const createClusterIcon = (count: number): Leaflet.DivIcon =>
    Leaflet.divIcon({
        className: styles.pastuvCluster,
        html: `<span>${count > 999 ? '999+' : count}</span>`,
        iconAnchor: [16, 16],
        iconSize: [32, 32]
    })
