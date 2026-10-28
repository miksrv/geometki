import { ApiModel } from '@/api'

import { plainDateYear } from './date'

export interface PhotoYearGroup {
    /** `undefined` for photos with no date at all */
    year?: number
    /** The photo and its index in the list the groups were made from */
    items: Array<{ photo: ApiModel.Photo; index: number }>
}

/** The year a photo shows ("then and now"): the visit day when it came from a visit, else the upload day */
export const getPhotoYear = (photo: ApiModel.Photo): number | undefined =>
    plainDateYear(photo.visitedAt ?? photo.created?.date)

/**
 * Photos grouped by year, the latest year first, once they come from two or more different
 * years; `null` while there is one year (or none): a plain grid needs no headings. The
 * order inside a year is kept.
 */
export const groupPhotosByYear = (photos: ApiModel.Photo[]): PhotoYearGroup[] | null => {
    const groups = new Map<number | undefined, PhotoYearGroup>()

    photos.forEach((photo, index) => {
        const year = getPhotoYear(photo)
        const group = groups.get(year) ?? { items: [], year }

        group.items.push({ index, photo })
        groups.set(year, group)
    })

    const years = [...groups.keys()].filter((year) => year !== undefined)

    if (years.length < 2) {
        return null
    }

    return [...groups.values()].sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity))
}
