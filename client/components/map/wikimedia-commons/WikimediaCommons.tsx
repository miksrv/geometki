import React, { useEffect, useState } from 'react'
import { Marker, Tooltip, useMapEvents } from 'react-leaflet'

import { ApiModel } from '@/api'
import { APIWikimediaCommons, RequestGetByBounds, WikimediaGeoItem } from '@/api/apiWikimediaCommons'

import { buildParams, cleanTitle, createWikimediaIcon, extractImageInfo } from './utils'

interface WikimediaCommonsProps {
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

export const WikimediaCommons: React.FC<WikimediaCommonsProps> = ({ onPhotoClick }) => {
    const [params, setParams] = useState<RequestGetByBounds | null>(null)
    const [loadingPhotoId, setLoadingPhotoId] = useState<number | null>(null)

    const map = useMapEvents({
        moveend: () => {
            setParams(buildParams(map.getBounds()))
        }
    })

    useEffect(() => {
        setParams(buildParams(map.getBounds()))
    }, [])

    const { data } = APIWikimediaCommons.useGetByBoundsQuery(params!, { skip: !params })
    const [getImageInfo] = APIWikimediaCommons.useLazyGetImageInfoQuery()

    const handleMarkerClick = async (item: WikimediaGeoItem) => {
        setLoadingPhotoId(item.pageid)

        const result = await getImageInfo(item.title)
        const imageInfo = result.data ? extractImageInfo(result.data) : undefined

        if (imageInfo) {
            const photoMark: ApiModel.PhotoMark = {
                full: imageInfo.url,
                lat: item.lat,
                lon: item.lon,
                preview: imageInfo.thumburl ?? imageInfo.url,
                title: cleanTitle(item.title)
            }

            onPhotoClick?.([photoMark], 0)
        }

        setLoadingPhotoId(null)
    }

    const items = data?.query?.geosearch ?? []

    if (!items.length) {
        return null
    }

    return (
        <>
            {items.map((item) => (
                <Marker
                    key={item.pageid}
                    position={[item.lat, item.lon]}
                    icon={createWikimediaIcon(loadingPhotoId === item.pageid)}
                    eventHandlers={{ click: () => handleMarkerClick(item) }}
                >
                    <Tooltip
                        direction={'top'}
                        offset={[0, -12]}
                    >
                        {cleanTitle(item.title)}
                    </Tooltip>
                </Marker>
            ))}
        </>
    )
}
