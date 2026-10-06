import { DateTime } from '@/api/types'

export type SiteMap = {
    id: string
    slug?: string | null
    updated: DateTime
}
