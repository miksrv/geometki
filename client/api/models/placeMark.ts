import { Categories } from './category'
import { Place } from './place'

export type PlaceMark = Pick<Place, 'lat' | 'lon' | 'distance'> & {
    id?: string
    type?: 'cluster' | 'point'
    count?: number
    category: Categories
    /** The name for the marker's hint, in the request locale; clusters have none */
    title?: string
    /** Client only: the person's relation to the place on their map (`UserPlacesMap`), a coloured frame of the marker */
    tone?: PlaceMarkTone
}

/** The relation of a person to a place on their map: added it, has been there, keeps it in bookmarks */
export type PlaceMarkTone = 'added' | 'visited' | 'bookmark'
