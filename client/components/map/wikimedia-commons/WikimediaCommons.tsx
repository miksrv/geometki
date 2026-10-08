import React, { useEffect, useMemo, useState } from 'react'
import { Marker, Tooltip, useMapEvents } from 'react-leaflet'

import { ApiModel } from '@/api'
import { APIWikimediaCommons, RequestGetByBounds } from '@/api/apiWikimediaCommons'

import { useReportLayerStatus } from '../layers-status'
import { MapAdditionalLayersEnum } from '../types'

import { WIKIMEDIA_COMMONS_LIMIT } from './constants'
import { buildParams, createWikimediaIcon, extractPhotoMarks } from './utils'

interface WikimediaCommonsProps {
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

export const WikimediaCommons: React.FC<WikimediaCommonsProps> = ({ onPhotoClick }) => {
    const [params, setParams] = useState<RequestGetByBounds | null>(null)

    const map = useMapEvents({
        moveend: () => {
            setParams(buildParams(map.getBounds()))
        }
    })

    useEffect(() => {
        setParams(buildParams(map.getBounds()))
    }, [])

    const { data, isFetching, isError } = APIWikimediaCommons.useGetByBoundsQuery(params!, { skip: !params })

    const photos = useMemo(() => extractPhotoMarks(data), [data])

    useReportLayerStatus(MapAdditionalLayersEnum.WIKIMEDIA_COMMONS, {
        count: photos.length,
        error: isError,
        // Compared with the files found, some of them have no position or image and are not shown
        limited: Object.keys(data?.query?.pages ?? {}).length >= WIKIMEDIA_COMMONS_LIMIT,
        loading: !params || isFetching
    })
    const icon = useMemo(() => createWikimediaIcon(), [])

    if (!photos.length) {
        return null
    }

    return (
        <>
            {photos.map((photo, index) => (
                <Marker
                    key={photo.pageid}
                    position={[photo.lat, photo.lon]}
                    icon={icon}
                    // Every photo of the visible area goes to the lightbox, starting from the clicked one
                    eventHandlers={{ click: () => onPhotoClick?.(photos, index) }}
                >
                    <Tooltip
                        direction={'top'}
                        offset={[0, -12]}
                    >
                        {photo.title}
                    </Tooltip>
                </Marker>
            ))}
        </>
    )
}
