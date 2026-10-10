import { ApiModel } from '@/api'

export interface GetListResponse {
    items: ApiModel.Activity[]
    has_more?: boolean
    /** Total rows for the `author` / `place` filters (not groups) */
    count?: number
}

export interface GetListRequest {
    date?: string
    author?: string
    place?: string
    limit?: number
    offset?: number
}
