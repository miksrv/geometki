export interface ListResponse {
    rating?: number
    count?: number
    vote?: number | null
    /** Votes per score, keys 1 to 5 */
    distribution?: Record<string, number>
}

export interface PutRequest {
    place: string
    score: number
}

export interface PutResponse {
    rating: number
}
