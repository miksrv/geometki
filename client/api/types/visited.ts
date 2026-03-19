import { ApiModel } from '@/api'

export interface ListResponse {
    items: ApiModel.User[]
}

export interface PutRequest {
    place: string
}
