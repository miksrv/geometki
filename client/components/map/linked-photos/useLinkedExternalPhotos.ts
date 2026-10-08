import { useEffect, useMemo, useState } from 'react'
import { useMapEvents } from 'react-leaflet'
import { LatLngBounds } from 'leaflet'

import { API, ApiModel, ApiType } from '@/api'
import { externalKey } from '@/components/shared/nearby-photos/utils'

/** The server looks for the linked photos in an area up to 1 square degree, a bigger one is not asked */
const MAX_AREA = 1

const boundsParam = (bounds: LatLngBounds): string | undefined => {
    const [south, west, north, east] = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()]

    // Too big, or across the antimeridian (west > east), which the server does not take
    if (west >= east || (north - south) * (east - west) > MAX_AREA) {
        return undefined
    }

    return [south, west, north, east].map((value) => value.toFixed(5)).join(',')
}

/**
 * Wikimedia Commons and PastVu photos of the visible area that are already linked to our places,
 * by the photo key (`source:id`): the layers mark them, so they are not linked twice
 */
export const useLinkedExternalPhotos = (
    source: ApiModel.PhotoExternalSource
): Map<string, ApiType.ExternalPhotos.ListItem> => {
    const [bounds, setBounds] = useState<string>()

    const map = useMapEvents({
        moveend: () => setBounds(boundsParam(map.getBounds()))
    })

    useEffect(() => {
        setBounds(boundsParam(map.getBounds()))
    }, [])

    const { data } = API.useExternalPhotosGetListQuery({ bounds }, { skip: !bounds })

    return useMemo(
        () =>
            new Map(
                (data?.items ?? [])
                    .filter((item) => item.source === source)
                    .map((item) => [externalKey(item.source, item.externalId), item])
            ),
        [data, source]
    )
}

/** "Добавлено к: …" for the tooltip of a linked photo */
export const linkedPlacesTitle = (item?: ApiType.ExternalPhotos.ListItem): string | undefined =>
    item?.places
        ?.map(({ title }) => title)
        .filter(Boolean)
        .join(', ')
