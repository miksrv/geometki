import { ApiModel } from '@/api'

export interface Response {
    places?: ApiModel.SiteMap[]
    users?: ApiModel.SiteMap[]
    collections?: ApiModel.SiteMap[]
}
