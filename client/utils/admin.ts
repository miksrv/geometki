import { IconTypes } from 'simple-react-ui-kit'

export const ADMIN_HREF = '/admin'
export const ADMIN_SEASONS_HREF = '/admin/seasons'
export const ADMIN_ACHIEVEMENTS_HREF = '/admin/achievements'
export const ADMIN_MAIL_HREF = '/admin/sending-mail'
export const ADMIN_MAILINGS_HREF = '/admin/mailings'

export type AdminSectionKey = 'seasons' | 'achievements' | 'mailings' | 'mail'

export interface AdminNavSection {
    key: AdminSectionKey
    href: string
    icon: IconTypes
    /** The translation key of the section's title: the same words in the navigation, the page and the dashboard */
    title: string
}

/** The sections of the admin, in the order of its navigation; a new section is one more line here */
export const ADMIN_SECTIONS: AdminNavSection[] = [
    { href: ADMIN_SEASONS_HREF, icon: 'Calendar', key: 'seasons', title: 'admin-seasons-title' },
    { href: ADMIN_ACHIEVEMENTS_HREF, icon: 'Award', key: 'achievements', title: 'achievements-admin-title' },
    { href: ADMIN_MAILINGS_HREF, icon: 'Comment', key: 'mailings', title: 'admin-mailings-title' },
    { href: ADMIN_MAIL_HREF, icon: 'Feed', key: 'mail', title: 'sending-mail-admin-title' }
]

/** A list of the admin with its filters in the query: `/admin/sending-mail?status=error`; empty values are left out */
export const adminListHref = (href: string, filters: Record<string, string | number | undefined> = {}): string => {
    const query = Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')

    return query ? `${href}?${query}` : href
}

/** The periods of a log's filter and how many days back each one looks */
export const ADMIN_PERIOD_DAYS = { '1d': 1, '30d': 30, '7d': 7 } as const

export type AdminPeriod = keyof typeof ADMIN_PERIOD_DAYS

export const isAdminPeriod = (value: string | undefined): value is AdminPeriod =>
    !!value && Object.prototype.hasOwnProperty.call(ADMIN_PERIOD_DAYS, value)
