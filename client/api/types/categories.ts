import { ApiModel } from '@/api'

export interface Response {
    items?: ApiModel.Category[]
}

export interface Request {
    places?: boolean
}

export interface TopRequest {
    limit?: number
}

export interface TopResponse {
    items?: ApiModel.TopCategory[]
}
