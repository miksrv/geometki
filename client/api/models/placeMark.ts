import { Categories } from './category'
import { Place } from './place'

export type PlaceMark = Pick<Place, 'lat' | 'lon' | 'distance'> & {
    id?: string
    type?: 'cluster' | 'point'
    count?: number
    category: Categories
    /** The name for the marker's hint, in the request locale; clusters have none */
    title?: string
}
