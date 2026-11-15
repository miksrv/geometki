import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import useRequireAuth from '@/hooks/useRequireAuth'
import { GAME_HREF } from '@/utils/game'

import styles from './styles.module.sass'

type BottomNavItem = {
    href: string
    icon: IconTypes
    label: string
    /** Route prefix used to highlight the item (defaults to href) */
    match?: string
    /** Requires authorization, opens the auth dialog for guests */
    auth?: boolean
    /** Rendered as the prominent center action */
    primary?: boolean
}

export const isBottomNavItemActive = (pathname: string, match: string): boolean =>
    pathname === match || pathname.startsWith(`${match}/`)

/**
 * Mobile-only bottom navigation: the same four sections as the desktop app bar with
 * the primary "add place" action in the center, within thumb reach. The profile lives
 * behind the avatar in the app bar, the activity feed behind the home page widget.
 *
 * Icons only, like the tab bars of the big mobile apps: the labels stay as aria-label for
 * screen readers. A tap on the section you are already at the root of scrolls it to the top.
 */
export const BottomNav: React.FC = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const requireAuth = useRequireAuth()

    const add: BottomNavItem = {
        auth: true,
        href: '/places/create',
        icon: 'PlusCircle',
        label: t('nav-add', { defaultValue: 'Добавить' }),
        primary: true
    }

    // Kept strictly symmetric: 2 items, the primary "add place" action in the
    // center, 2 items — so the center button is visually centered on all widths. The map is
    // always first, then the places. The game comes right after the centre and the explorers
    // give theirs up: the game has its own rating of them, and their list is a tap away from
    // the home page. The quests are a tap away from the game page.
    const items: BottomNavItem[] = [
        { href: '/map', icon: 'Map', label: t('nav-map', { defaultValue: 'Карта' }) },
        { href: '/places', icon: 'Point', label: t('nav-places', { defaultValue: 'Места' }) },
        add,
        { href: GAME_HREF, icon: 'Award', label: t('nav-game', { defaultValue: 'Игра' }) },
        { href: '/collections', icon: 'Layers', label: t('nav-collections', { defaultValue: 'Коллекции' }) }
    ]

    const handleClick = (event: React.MouseEvent, item: BottomNavItem) => {
        if (item.auth) {
            requireAuth(event)
            return
        }

        // Already at the root of this section: back to the top instead of reloading it
        if (router.pathname === item.href && window.scrollY > 0) {
            event.preventDefault()
            window.scrollTo({ behavior: 'smooth', top: 0 })
        }
    }

    return (
        <nav
            className={styles.bottomNav}
            aria-label={t('main-navigation', { defaultValue: 'Основная навигация' })}
        >
            {items.map((item) => {
                const active = !item.primary && isBottomNavItemActive(router.pathname, item.match ?? item.href)

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(styles.navItem, item.primary && styles.primary, active && styles.active)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={item.label}
                        onClick={(event) => handleClick(event, item)}
                    >
                        <span className={styles.indicator}>
                            {item.primary ? <span className={styles.plus} /> : <Icon name={item.icon} />}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
