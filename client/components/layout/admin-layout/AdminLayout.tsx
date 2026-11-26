import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import NextNProgress from 'nextjs-progressbar'

import { useAppSelector } from '@/app/store'
import { useAdminAttention } from '@/hooks/useAdminAttention'
import { ADMIN_HREF, ADMIN_SECTIONS, AdminSectionKey } from '@/utils/admin'

import { AppAuthChecker } from '../app-bar/AppAuthChecker'
import { Snackbar } from '../snackbar'

import styles from './styles.module.sass'

interface AdminLayoutProps {
    /**
     * A list page: on desktop the page is exactly one viewport high and only its table scrolls,
     * under its own sticky header — the title, the views and the filters stay in place. Phones
     * keep the regular scrolling page.
     */
    fit?: boolean
    children?: React.ReactNode
}

type Mark = { tone: 'danger' | 'warning' | 'info'; count?: number }

/**
 * The frame of the admin (ADMIN-UI.md → The shell): a workspace of its own, not a page of the
 * site — the side navigation of sections (a row under the bar on phones) with a mark on a
 * section that needs attention, the way back to the site, and the content on the rest of the
 * width. No site header, search, footer or bottom navigation.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({ fit, children }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const user = useAppSelector((state) => state.auth.user)
    const { items } = useAdminAttention()

    // A section's mark: its worst tone (the list comes sorted by it) and the sum of what is counted
    const marks = items.reduce<Partial<Record<AdminSectionKey, Mark>>>((result, item) => {
        const mark = result[item.section] ?? { tone: item.tone }

        result[item.section] = item.count ? { ...mark, count: (mark.count ?? 0) + item.count } : mark

        return result
    }, {})

    const nav = [
        { href: ADMIN_HREF, icon: 'BarChart' as const, key: 'overview', label: t('admin-overview') },
        ...ADMIN_SECTIONS.map((section) => ({ ...section, label: t(section.title) }))
    ]

    const isActive = (href: string) =>
        href === ADMIN_HREF ? router.pathname === ADMIN_HREF : router.pathname.startsWith(href)

    return (
        <div className={cn(styles.adminLayout, fit && styles.fit)}>
            <a
                href={'#main-content'}
                className={styles.skipLink}
            >
                {t('skip-to-content', { defaultValue: 'Перейти к содержимому' })}
            </a>

            <NextNProgress
                color={'var(--color-main)'}
                options={{ showSpinner: false }}
                // A filter written into the URL is no page load: the bar runs only for real navigation
                showOnShallow={false}
            />

            <AppAuthChecker />

            <aside className={styles.sidebar}>
                <Link
                    href={ADMIN_HREF}
                    className={styles.brand}
                >
                    <span
                        className={styles.logoMark}
                        aria-hidden={true}
                    />
                    <span className={styles.brandText}>
                        <b>Geometki</b>
                        <span>{t('admin-title')}</span>
                    </span>
                </Link>

                <nav
                    className={styles.nav}
                    aria-label={t('admin-navigation')}
                >
                    {nav.map(({ key, href, icon, label }) => {
                        const active = isActive(href)
                        const mark = marks[key as AdminSectionKey]

                        return (
                            <Link
                                key={key}
                                href={href}
                                className={cn(styles.navItem, active && styles.active)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon name={icon} />
                                <span className={styles.navLabel}>{label}</span>
                                {mark && (
                                    <span className={cn(styles.mark, styles[mark.tone], !mark.count && styles.dot)}>
                                        {/* A label on a plain span is not read: the words go in as hidden text */}
                                        <span className={styles.hidden}>
                                            {t('admin-attention-title')}
                                            {mark.count ? ': ' : ''}
                                        </span>
                                        {mark.count ? (mark.count > 99 ? '99+' : mark.count) : ''}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                <div className={styles.foot}>
                    <Link
                        href={'/'}
                        className={styles.navItem}
                    >
                        <Icon name={'Exit'} />
                        <span className={styles.navLabel}>{t('admin-back-to-site')}</span>
                    </Link>
                    {user?.name && <span className={styles.user}>{user.name}</span>}
                </div>
            </aside>

            <main
                id={'main-content'}
                className={styles.main}
            >
                <div className={styles.content}>{children}</div>
            </main>

            <Snackbar />
        </div>
    )
}
