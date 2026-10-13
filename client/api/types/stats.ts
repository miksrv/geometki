import type { Categories } from '../models/category'

export interface CategoryCount {
    name: Categories
    count: number
}

export interface GetResponse {
    places: number
    /** Open OSM candidates of the default map groups: places that are not on Geometki yet */
    unexplored: number
    photos: number
    reviews: number
    /** Places per category, the fullest first; categories without places are left out */
    categories?: CategoryCount[]
}
