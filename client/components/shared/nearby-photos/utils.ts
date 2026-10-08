import { ApiModel, ApiType } from '@/api'
import { ResponseGetNearest } from '@/api/apiPastvu'
import { ResponseGetByBounds } from '@/api/apiWikimediaCommons'
import { IMG_HOST as PASTVU_IMG_HOST } from '@/components/map/historical-photos/constants'
import { extractPhotoMarks } from '@/components/map/wikimedia-commons/utils'
import { haversineDistanceKm, LatLon } from '@/utils/geo'

/** A Wikimedia Commons or PastVu photo near a place that can be linked to it */
export type NearbyPhoto = ApiModel.PhotoMark & {
    key: string
    source: ApiModel.PhotoExternalSource
    externalId: string
    year?: number
    /** Meters from the place */
    distance: number
}

export const externalKey = (source: ApiModel.PhotoExternalSource, externalId: string | number): string =>
    `${source}:${externalId}`

/** Commons media types that are pictures: audio, video and documents are files too */
const PICTURE_MEDIA_TYPES = ['BITMAP', 'DRAWING']

const onlyPictures = (data?: ResponseGetByBounds): ResponseGetByBounds | undefined =>
    data?.query?.pages
        ? {
              query: {
                  pages: Object.fromEntries(
                      Object.entries(data.query.pages).filter(([, page]) => {
                          const mediatype = page.imageinfo?.[0]?.mediatype
                          return !mediatype || PICTURE_MEDIA_TYPES.includes(mediatype)
                      })
                  )
              }
          }
        : data

/** Photos of both sources around the place, nearest first */
export const buildNearbyPhotos = (
    place: LatLon,
    commons?: ResponseGetByBounds,
    pastvu?: ResponseGetNearest
): NearbyPhoto[] => {
    const distance = (point: LatLon) => Math.round(haversineDistanceKm(place, point) * 1000)

    const commonsPhotos: NearbyPhoto[] = extractPhotoMarks(onlyPictures(commons)).map(({ pageid, ...photo }) => ({
        ...photo,
        distance: distance(photo),
        externalId: String(pageid),
        key: externalKey('wikimedia', pageid),
        source: 'wikimedia'
    }))

    const pastvuPhotos: NearbyPhoto[] = (pastvu?.result?.photos ?? []).map((photo) => ({
        distance: distance({ lat: photo.geo[0], lon: photo.geo[1] }),
        externalId: String(photo.cid),
        full: `${PASTVU_IMG_HOST}/a/${photo.file}`,
        key: externalKey('pastvu', photo.cid),
        lat: photo.geo[0],
        lon: photo.geo[1],
        preview: `${PASTVU_IMG_HOST}/h/${photo.file}`,
        source: 'pastvu',
        title: `${photo.title ?? ''}${photo.year ? ` (${photo.year})` : ''}`,
        year: photo.year
    }))

    return [...commonsPhotos, ...pastvuPhotos].sort((a, b) => a.distance - b.distance)
}

/** Link ids of the place by the photo key: which photos are linked and how to unlink them */
export const buildLinksMap = (items?: ApiType.ExternalPhotos.ListItem[]): Map<string, string> =>
    new Map(
        (items ?? []).filter(({ id }) => id).map(({ id, source, externalId }) => [externalKey(source, externalId), id!])
    )
