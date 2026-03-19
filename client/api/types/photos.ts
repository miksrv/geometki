import { ApiModel } from '@/api'

export interface DeleteRequest {
    id?: string
    temporary?: boolean
}

export interface DeleteResponse {
    id?: string
}

export interface UploadRequest {
    formData?: FormData
    place?: string
    count?: number
}

export type UploadResponse = ApiModel.Photo

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
