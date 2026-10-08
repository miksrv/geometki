export interface GetResponse {
    places: number
    /** Open OSM candidates of the default map groups: places that are not on Geometki yet */
    unexplored: number
    photos: number
    reviews: number
}
