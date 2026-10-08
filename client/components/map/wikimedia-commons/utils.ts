import Leaflet, { LatLngBounds } from 'leaflet'

import { ApiModel } from '@/api'
import { RequestGetByBounds, ResponseGetByBounds } from '@/api/apiWikimediaCommons'

import { WIKIMEDIA_COMMONS_COLOR, WIKIMEDIA_COMMONS_PREVIEW_WIDTH } from './constants'

import styles from './styles.module.sass'

export const buildParams = (bounds: LatLngBounds): RequestGetByBounds => ({
    east: bounds.getEast(),
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    west: bounds.getWest()
})

export const cleanTitle = (title: string): string => title.replace(/^File:/, '').replace(/_/g, ' ')

export const createWikimediaIcon = (): Leaflet.DivIcon => {
    const color = WIKIMEDIA_COMMONS_COLOR

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

export type WikimediaPhotoMark = ApiModel.PhotoMark & { pageid: number }

/**
 * A smaller copy of a Commons thumbnail: its URL holds the width as `<width>px-`.
 * A link to the original (the file is smaller than the requested width) has no such part
 * and is used as is.
 */
export const resizeThumbUrl = (url: string, width: number): string =>
    url.includes('/thumb/') ? url.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`) : url

/** Files with a position and an image link, in the geosearch order */
export const extractPhotoMarks = (data?: ResponseGetByBounds): WikimediaPhotoMark[] =>
    Object.values(data?.query?.pages ?? {})
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .flatMap((page) => {
            const coordinates = page.coordinates?.[0]
            const info = page.imageinfo?.[0]

            if (!coordinates || !info?.url) {
                return []
            }

            const full = info.thumburl ?? info.url
            // The thumbnail is never bigger than the original, though its reported size can be
            const width = info.width && info.thumbwidth ? Math.min(info.width, info.thumbwidth) : undefined
            const height =
                width && info.width && info.height ? Math.round((width / info.width) * info.height) : undefined

            return [
                {
                    full,
                    height,
                    lat: coordinates.lat,
                    lon: coordinates.lon,
                    pageid: page.pageid,
                    preview: resizeThumbUrl(full, WIKIMEDIA_COMMONS_PREVIEW_WIDTH),
                    title: cleanTitle(page.title),
                    width
                }
            ]
        })
