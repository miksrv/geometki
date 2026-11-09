import { ApiModel, ApiType } from '@/api'

export type GetByTypeResponse = ApiModel.AddressItem

export interface GetByTypeRequest {
    id?: number | null
    type?: ApiType.LocationTypes
}

export interface SearchResponse {
    countries?: ApiModel.AddressItem[]
    regions?: ApiModel.AddressItem[]
    districts?: ApiModel.AddressItem[]
    cities?: ApiModel.AddressItem[]
}
