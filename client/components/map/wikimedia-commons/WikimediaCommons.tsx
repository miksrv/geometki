import React, { useEffect, useMemo, useState } from 'react'
import { Marker, Tooltip, useMapEvents } from 'react-leaflet'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { APIWikimediaCommons, RequestGetByBounds } from '@/api/apiWikimediaCommons'
import { externalKey } from '@/components/shared/nearby-photos/utils'

import { isGeoSearchTooBig } from '../bounds'
import { useReportLayerStatus } from '../layers-status'
import { linkedPhotoStyles, linkedPlacesTitle, useLinkedExternalPhotos } from '../linked-photos'
import { MapAdditionalLayersEnum } from '../types'

import { WIKIMEDIA_COMMONS_LIMIT } from './constants'
import { buildParams, createWikimediaIcon, extractPhotoMarks } from './utils'

interface WikimediaCommonsProps {
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
}

export const WikimediaCommons: React.FC<WikimediaCommonsProps> = ({ onPhotoClick }) => {
    const { t } = useTranslation()
    const [params, setParams] = useState<RequestGetByBounds | null>(null)
    // The API answers nothing for a big area (see isGeoSearchTooBig): it is not asked
    const [tooLarge, setTooLarge] = useState(false)

    const updateParams = () => {
        const bounds = map.getBounds()
        const isTooLarge = isGeoSearchTooBig(bounds)

        setTooLarge(isTooLarge)
        setParams(isTooLarge ? null : buildParams(bounds))
    }

    const map = useMapEvents({
        moveend: updateParams
    })

    useEffect(() => {
        updateParams()
    }, [])

    const { data, isFetching, isError } = APIWikimediaCommons.useGetByBoundsQuery(params!, { skip: !params })

    const photos = useMemo(() => (params ? extractPhotoMarks(data) : []), [data, params])

    useReportLayerStatus(MapAdditionalLayersEnum.WIKIMEDIA_COMMONS, {
        count: photos.length,
        error: isError,
        // Compared with the files found, some of them have no position or image and are not shown
        limited: Object.keys(data?.query?.pages ?? {}).length >= WIKIMEDIA_COMMONS_LIMIT,
        loading: !tooLarge && (!params || isFetching),
        tooLarge
    })
    const icon = useMemo(() => createWikimediaIcon(), [])
    const linkedIcon = useMemo(() => createWikimediaIcon(linkedPhotoStyles.linked), [])
    const linked = useLinkedExternalPhotos('wikimedia')

    if (!photos.length) {
        return null
    }

    return (
        <>
            {photos.map((photo, index) => {
                const link = linked.get(externalKey('wikimedia', photo.pageid))

                return (
                    <Marker
                        key={`${photo.pageid}${link ? '-linked' : ''}`}
                        position={[photo.lat, photo.lon]}
                        icon={link ? linkedIcon : icon}
                        // Every photo of the visible area goes to the lightbox, starting from the clicked one
                        eventHandlers={{ click: () => onPhotoClick?.(photos, index) }}
                    >
                        <Tooltip
                            direction={'top'}
                            offset={[0, -12]}
                        >
                            {photo.title}
                            {link && (
                                <>
                                    <br />
                                    {t('linked-to', {
                                        defaultValue: 'Добавлено к: {{places}}',
                                        places: linkedPlacesTitle(link)
                                    })}
                                </>
                            )}
                        </Tooltip>
                    </Marker>
                )
            })}
        </>
    )
}
