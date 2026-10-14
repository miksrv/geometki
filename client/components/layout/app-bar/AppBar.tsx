import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { openAuthDialog } from '@/app/applicationSlice'
import { logoutUser } from '@/app/logoutUser'
import { useAppDispatch, useAppSelector } from '@/app/store'
import useRequireAuth from '@/hooks/useRequireAuth'

import { AppAuthChecker } from './AppAuthChecker'
import { Logo } from './Logo'
import { NotificationList } from './NotificationList'
import { Search } from './Search'
import { UserMenu } from './UserMenu'

import styles from './styles.module.sass'

type NavItem = {
    label: string
    href: string
}

interface AppBarProps {
    fullSize?: boolean
}

export const isNavItemActive = (pathname: string, href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`)

export const AppBar: React.FC<AppBarProps> = ({ fullSize }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const requireAuth = useRequireAuth()
    const router = useRouter()

    const appAuth = useAppSelector((state) => state.auth)

    const navItems: NavItem[] = [
        { href: '/map', label: t('nav-map', { defaultValue: 'Карта' }) },
        { href: '/places', label: t('nav-places', { defaultValue: 'Места' }) },
        { href: '/collections', label: t('nav-collections', { defaultValue: 'Коллекции' }) },
        { href: '/users', label: t('nav-users', { defaultValue: 'Люди' }) }
    ]

    const handleLoginClick = (event: React.MouseEvent) => {
        event.preventDefault()
        dispatch(openAuthDialog())
    }

    const handleLogout = () => {
        dispatch(logoutUser())
    }

    return (
        <header className={cn(styles.appBar, fullSize && styles.fullSize)}>
            <AppAuthChecker />
            <div className={styles.wrapper}>
                <Logo />

                <nav
                    className={styles.nav}
                    aria-label={t('main-navigation', { defaultValue: 'Основная навигация' })}
                >
                    {navItems.map((item) => {
                        const active = isNavItemActive(router.pathname, item.href)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(styles.navItem, active && styles.navItemActive)}
                                aria-current={active ? 'page' : undefined}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className={styles.rightSection}>
                    <Search />

                    <Button
                        mode={'primary'}
                        size={'medium'}
                        icon={'PlusCircle'}
                        link={'/places/create'}
                        label={t('add-place_button', { defaultValue: 'Добавить место' })}
                        tooltip={t('add-place_title', { defaultValue: 'Добавить новое место на карту' })}
                        className={styles.addButton}
                        onClick={requireAuth}
                    />

                    {appAuth.isAuth === true && <NotificationList />}

                    {appAuth.isAuth === true && appAuth.user && (
                        <UserMenu
                            t={t}
                            user={appAuth.user}
                            onLogout={handleLogout}
                        />
                    )}

                    {appAuth.isAuth !== true && (
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            tooltip={t('authorization-on-site_title', {
                                defaultValue: 'Авторизация на сайте'
                            })}
                            label={t('sign-in_button', { defaultValue: 'Войти' })}
                            className={styles.loginButton}
                            onClick={handleLoginClick}
                        />
                    )}
                </div>
            </div>
        </header>
    )
}
