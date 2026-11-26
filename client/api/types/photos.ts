import { ApiModel } from '@/api'

export interface DeleteRequest {
    id?: string
    temporary?: boolean
}

export interface DeleteResponse {
    id?: string
}

export interface UploadRequest {
    /** `photo`; the server links it to the uploader's visit of that day */
    formData?: FormData
    place?: string
    count?: number
}

export type UploadResponse = ApiModel.Photo & {
    /** The game: the photo was shot at the place within the season and confirmed a visit — the points it brought (0 when the place was counted already) and the season's total */
    game?: { points: number; total: number | null } | null
}

export interface RotateRequest {
    id?: string
    temporary?: boolean
}

export interface RotateResponse {
    id?: string
    full?: string
    preview?: string
}

export interface ListRequest {
    limit?: number
    offset?: number
    author?: string
    place?: string
}

export interface ListResponse {
    items?: ApiModel.Photo[]
    count?: number
}
