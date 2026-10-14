import { DateTime, Locale } from '@/api/types'

export type SiteMap = {
    id: string
    slug?: string | null
    updated: DateTime
    /** Places only: the locales the place has a text in, its only language versions */
    locales?: Locale[]
}
