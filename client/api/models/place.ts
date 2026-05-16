import { DateTime } from '@/api/types'

import { Address } from './address'
import { Category } from './category'
import { User } from './user'

export type Place = {
    id: string
    created?: DateTime
    updated?: DateTime
    lat: number
    lon: number
    rating?: number
    views?: number
    photos?: number
    comments?: number
    bookmarks?: number
    title: string
    content?: string
    difference?: number
    distance?: number
    author?: User
    editors?: User[]
    category?: Category
    address?: Address
    tags?: string[]
    cover?: {
        full?: string
        preview: string
    }
    visitRadiusM?: number
    verificationExempt?: boolean
}
