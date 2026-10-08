import { Photo } from './photo'

export type PhotoMark = Pick<Photo, 'title' | 'preview' | 'full' | 'placeId' | 'author' | 'created'> &
    Partial<Pick<Photo, 'width' | 'height'>> & {
        type?: 'cluster' | 'point'
        count?: number
        lat: number
        lon: number
    }
