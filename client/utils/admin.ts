import { IconTypes } from 'simple-react-ui-kit'

export const ADMIN_HREF = '/admin'
export const ADMIN_ACHIEVEMENTS_HREF = '/admin/achievements'
export const ADMIN_MAILINGS_HREF = '/admin/mailings'

export type AdminSectionKey = 'achievements' | 'mailings' | 'mail'

export interface AdminNavSection {
    key: AdminSectionKey
    href: string
    icon: IconTypes
    /** The translation key of the section's title: the same words in the navigation, the page and the dashboard */
    title: string
}

/** The sections of the admin, in the order of its navigation; a new section is one more line here */
export const ADMIN_SECTIONS: AdminNavSection[] = [
    { href: ADMIN_ACHIEVEMENTS_HREF, icon: 'Award', key: 'achievements', title: 'achievements-admin-title' },
    { href: ADMIN_MAILINGS_HREF, icon: 'Comment', key: 'mailings', title: 'admin-mailings-title' }
]

/** The titles of what the admin watches without a page of its own: the sending of the emails (a dashboard card) */
export const ADMIN_SECTION_TITLES: Partial<Record<AdminSectionKey, string>> = {
    mail: 'admin-mail-title'
}

/** A list of the admin with its filters in the query: `/admin/mailings?status=draft`; empty values are left out */
export const adminListHref = (href: string, filters: Record<string, string | number | undefined> = {}): string => {
    const query = Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')

    return query ? `${href}?${query}` : href
}
