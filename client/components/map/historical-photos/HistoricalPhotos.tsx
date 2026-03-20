'use client'

import React from 'react'
import { Marker } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel } from '@/api'
import { APIPastvu } from '@/api/apiPastvu'

import { MapPositionType } from '../types'

import styles from './styles.module.sass'

interface HistoricalPhotosProps {
    position?: MapPositionType
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

const IMG_HOST = 'https://pastvu.com/_p'

export const HistoricalPhotos: React.FC<HistoricalPhotosProps> = ({ position, onPhotoClick }) => {
    const { data: photosData } = APIPastvu.useNearestGetPhotosQuery(
        {
            lat: position?.lat ?? 0,
            lon: position?.lon ?? 0
        },
        { skip: !position?.lat || !position.lon }
    )

    const photoUrl = (file: string, full?: boolean) => `${IMG_HOST}/${full ? 'a' : 'h'}/${file}`

    return photosData?.result.photos.length ? (
        photosData.result.photos.map((photo, index) => (
            <Marker
                key={photo.cid}
                position={[photo.geo[0], photo.geo[1]]}
                icon={
                    new Leaflet.Icon({
                        className: styles.historicalPhoto,
                        iconAnchor: [25, 16],
                        iconSize: [50, 32],
                        iconUrl: photoUrl(photo.file)
                    })
                }
                title={photo.title}
                alt={photo.title}
                eventHandlers={{
                    click: () => {
                        onPhotoClick?.(
                            photosData.result.photos.map((item) => ({
                                full: photoUrl(item.file, true),
                                lat: item.geo[0],
                                lon: item.geo[1],
                                preview: photoUrl(item.file),
                                title: `${item.title}${item.year ? ` (${item.year})` : ''}`
                            })),
                            index
                        )
                    }
                }}
            />
        ))
    ) : (
        <></>
    )
}
