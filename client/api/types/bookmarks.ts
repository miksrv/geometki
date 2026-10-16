export interface CheckResponse {
    result: boolean
}

export interface Request {
    placeId: string
}

/** `GET /bookmarks/places`: the IDs of every place in the visitor's bookmarks */
export interface PlacesResponse {
    items: string[]
}
