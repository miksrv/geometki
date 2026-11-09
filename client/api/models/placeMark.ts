import { Categories } from './category'
import { Place } from './place'

export type PlaceMark = Pick<Place, 'lat' | 'lon' | 'distance'> & {
    id?: string
    type?: 'cluster' | 'point'
    count?: number
    category: Categories
    /** The name for the marker's hint, in the request locale; clusters have none */
    title?: string
    /** Client only: the person has been to the place or keeps it in bookmarks (`UserPlacesMap`), a badge on the marker */
    tone?: PlaceMarkBadge
}

/** The relation of a person to a place on their map: added it, has been there, keeps it in bookmarks */
export type PlaceMarkTone = 'added' | 'visited' | 'bookmark'

/** The relations a marker carries a badge of: the person's own places are plain markers */
export type PlaceMarkBadge = Exclude<PlaceMarkTone, 'added'>
