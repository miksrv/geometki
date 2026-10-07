import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

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
 */
export const BottomNav: React.FC = () => {
    const { t } = useTranslation('components.bottom-nav')
    const router = useRouter()
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    // Kept strictly symmetric: 2 items, the primary "add place" action in the
    // center, 2 items — so the center button is visually centered on all widths.
    const items: BottomNavItem[] = [
        { href: '/map', icon: 'Map', label: t('nav-map', { defaultValue: 'Карта' }) },
        { href: '/places', icon: 'Point', label: t('nav-places', { defaultValue: 'Места' }) },
        {
            auth: true,
            href: '/places/create',
            icon: 'PlusCircle',
            label: t('nav-add', { defaultValue: 'Добавить' }),
            primary: true
        },
        { href: '/collections', icon: 'Layers', label: t('nav-collections', { defaultValue: 'Коллекции' }) },
        { href: '/users', icon: 'Users', label: t('nav-users', { defaultValue: 'Люди' }) }
    ]

    const handleClick = (event: React.MouseEvent, item: BottomNavItem) => {
        if (item.auth && isAuth !== true) {
            event.preventDefault()
            dispatch(openAuthDialog())
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
                        aria-label={item.primary ? item.label : undefined}
                        onClick={(event) => handleClick(event, item)}
                    >
                        <Icon name={item.icon} />
                        {!item.primary && <span>{item.label}</span>}
                    </Link>
                )
            })}
        </nav>
    )
}
