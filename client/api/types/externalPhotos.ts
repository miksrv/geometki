import { ApiModel } from '@/api'

export interface ListRequest {
    /** Links of one place */
    place?: string
    /** Linked photos inside a map area: south,west,north,east */
    bounds?: string
}

export interface ListItem {
    /** Link id, given for the links of one place */
    id?: string
    source: ApiModel.PhotoExternalSource
    externalId: string
    /** Places the photo is linked to, given for a map area */
    places?: Array<{ id: string; title?: string }>
}

export interface ListResponse {
    items?: ListItem[]
}

export interface CreateRequest {
    placeId: string
    source: ApiModel.PhotoExternalSource
    externalId: string
}

export type CreateResponse = ApiModel.Photo

export interface DeleteRequest {
    id: string
    placeId?: string
}

export interface DeleteResponse {
    id?: string
}
