import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Marker, useMapEvents } from 'react-leaflet'

import { ApiModel, ApiType } from '@/api'
import { APIPastvu, PastvuCluster, PastvuPhoto, RequestGetByBounds } from '@/api/apiPastvu'
import { externalKey } from '@/components/shared/nearby-photos/utils'

import { useReportLayerStatus } from '../layers-status'
import { linkedPhotoStyles, linkedPlacesTitle, useLinkedExternalPhotos } from '../linked-photos'
import { MapAdditionalLayersEnum } from '../types'

import { LOCAL_WORK_ZOOM, THUMBNAIL_ZOOM } from './constants'
import {
    buildParams,
    createClusterIcon,
    createDirectionIcon,
    createThumbnailIcon,
    groupPhotos,
    photoToMark
} from './utils'

interface PastvuMarkerProps {
    photo: PastvuPhoto
    index: number
    /** The photo itself instead of the direction arrow (close zoom) */
    thumbnail: boolean
    link?: ApiType.ExternalPhotos.ListItem
    onClick: (index: number) => void
}

/**
 * One photo on the map. The icon is built once per photo: a new `divIcon` object makes
 * react-leaflet replace the marker's DOM element, and a layer re-render (a map move, a status
 * report) must not re-create every `<img>` of the area
 */
const PastvuMarker = React.memo<PastvuMarkerProps>(({ photo, index, thumbnail, link, onClick }) => {
    const className = link ? linkedPhotoStyles.linked : undefined

    const icon = useMemo(
        () =>
            thumbnail
                ? createThumbnailIcon(photo.file, photo.year, className)
                : createDirectionIcon(photo.dir, photo.year, className),
        [thumbnail, photo.file, photo.year, photo.dir, className]
    )
    const position = useMemo<[number, number]>(() => [photo.geo[0], photo.geo[1]], [photo.geo])
    const eventHandlers = useMemo(() => ({ click: () => onClick(index) }), [onClick, index])

    const places = linkedPlacesTitle(link)

    return (
        <Marker
            position={position}
            icon={icon}
            title={places ? `${photo.title} → ${places}` : photo.title}
            alt={photo.title}
            eventHandlers={eventHandlers}
        />
    )
})

PastvuMarker.displayName = 'PastvuMarker'

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
    const linked = useLinkedExternalPhotos('pastvu')

    const photos: PastvuPhoto[] = data?.result.photos ?? []
    const clusters: PastvuCluster[] = data?.result.clusters ?? []

    // A cluster stands for several photos
    const photosCount = photos.length + clusters.reduce((sum, { c }) => sum + c, 0)

    useReportLayerStatus(MapAdditionalLayersEnum.HISTORICAL_PHOTOS, {
        count: photosCount,
        error: isError,
        loading: !params || isFetching
    })

    const allPhotoMarks = useMemo(() => photos.map(photoToMark), [photos])

    const handlePhotoClick = useCallback(
        (index: number) => onPhotoClick?.(allPhotoMarks, index),
        [onPhotoClick, allPhotoMarks]
    )

    const zoom = params?.z ?? 0

    // From LOCAL_WORK_ZOOM PastVu returns every photo of the area unclustered: grouped here
    const groups = useMemo(
        () =>
            zoom >= LOCAL_WORK_ZOOM
                ? groupPhotos(photos, (geo) => map.project(geo, zoom))
                : photos.map((photo, index) => ({ geo: photo.geo, indexes: [index] })),
        [photos, zoom]
    )

    // Closer if the map can zoom in, otherwise the group's photos in the viewer
    const handleGroupClick = (indexes: number[], geo: [number, number]) => {
        if (zoom < map.getMaxZoom()) {
            map.setView(geo, zoom + 1)
        } else {
            onPhotoClick?.(
                indexes.map((index) => allPhotoMarks[index]),
                0
            )
        }
    }

    if (!photos.length && !clusters.length) {
        return null
    }

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

            {groups.map(({ geo, indexes }) => {
                const photo = photos[indexes[0]]

                return indexes.length > 1 ? (
                    <Marker
                        key={`pastvu-group-${photo.cid}`}
                        position={geo}
                        icon={createClusterIcon(indexes.length)}
                        eventHandlers={{ click: () => handleGroupClick(indexes, geo) }}
                    />
                ) : (
                    <PastvuMarker
                        key={`pastvu-photo-${photo.cid}`}
                        photo={photo}
                        index={indexes[0]}
                        thumbnail={zoom >= THUMBNAIL_ZOOM}
                        link={linked.get(externalKey('pastvu', photo.cid))}
                        onClick={handlePhotoClick}
                    />
                )
            })}
        </>
    )
}
