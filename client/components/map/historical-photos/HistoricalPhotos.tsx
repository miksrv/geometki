import React, { useEffect, useState } from 'react'
import { Marker, useMapEvents } from 'react-leaflet'

import { ApiModel } from '@/api'
import { APIPastvu, PastvuCluster, PastvuPhoto, RequestGetByBounds } from '@/api/apiPastvu'

import { useReportLayerStatus } from '../layers-status'
import { MapAdditionalLayersEnum } from '../types'

import { THUMBNAIL_ZOOM } from './constants'
import { buildParams, createClusterIcon, createDirectionIcon, createThumbnailIcon, photoToMark } from './utils'

interface HistoricalPhotosProps {
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

export const HistoricalPhotos: React.FC<HistoricalPhotosProps> = ({ onPhotoClick }) => {
    const [params, setParams] = useState<RequestGetByBounds | null>(null)

    const map = useMapEvents({
        moveend: () => {
            setParams(buildParams(map.getBounds(), map.getZoom()))
        }
    })

    useEffect(() => {
        setParams(buildParams(map.getBounds(), map.getZoom()))
    }, [])

    const { data, isFetching, isError } = APIPastvu.useGetByBoundsQuery(params!, { skip: !params })

    // A cluster stands for several photos
    const photosCount =
        (data?.result.photos?.length ?? 0) + (data?.result.clusters ?? []).reduce((sum, { c }) => sum + c, 0)

    useReportLayerStatus(MapAdditionalLayersEnum.HISTORICAL_PHOTOS, {
        count: photosCount,
        error: isError,
        loading: !params || isFetching
    })

    if (!data) {
        return null
    }

    const zoom = params?.z ?? 0
    const photos: PastvuPhoto[] = data.result.photos ?? []
    const clusters: PastvuCluster[] = data.result.clusters ?? []

    if (!photos.length && !clusters.length) {
        return null
    }

    const allPhotoMarks = photos.map(photoToMark)

    return (
        <>
            {clusters.map((cluster, i) => (
                <Marker
                    key={`pastvu-cluster-${i}`}
                    position={[cluster.geo[0], cluster.geo[1]]}
                    icon={createClusterIcon(cluster.c)}
                    eventHandlers={{
                        click: () => map.setView([cluster.geo[0], cluster.geo[1]], zoom + 2)
                    }}
                />
            ))}

            {photos.map((photo, index) => (
                <Marker
                    key={`pastvu-photo-${photo.cid}`}
                    position={[photo.geo[0], photo.geo[1]]}
                    icon={
                        zoom >= THUMBNAIL_ZOOM
                            ? createThumbnailIcon(photo.file, photo.year)
                            : createDirectionIcon(photo.dir, photo.year)
                    }
                    title={photo.title}
                    alt={photo.title}
                    eventHandlers={{
                        click: () => onPhotoClick?.(allPhotoMarks, index)
                    }}
                />
            ))}
        </>
    )
}
