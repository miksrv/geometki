import React, { useEffect } from 'react'
import useGeolocation from 'react-hook-geolocation'
import { Button, cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { openAuthDialog, setUserLocation } from '@/app/applicationSlice'
import { logoutUser } from '@/app/logoutUser'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { round } from '@/utils/helpers'

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
    const { t } = useTranslation('components.app-bar')
    const dispatch = useAppDispatch()
    const router = useRouter()
    const geolocation = useGeolocation()

    const appAuth = useAppSelector((state) => state.auth)
    const userLocation = useAppSelector((state) => state.application.userLocation)

    const [updateLocation] = API.useLocationPutCoordinatesMutation()

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

    const handleAddPlaceClick = (event: React.MouseEvent) => {
        if (appAuth.isAuth !== true) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }
    }

    const handleLogout = () => {
        dispatch(logoutUser())
    }

    useEffect(() => {
        const updateLat = round(geolocation.latitude, 3)
        const updateLng = round(geolocation.longitude, 3)

        if (updateLat && updateLng && updateLat !== userLocation?.lat && updateLng !== userLocation?.lon) {
            const data: ApiType.Coordinates = {
                lat: updateLat,
                lon: updateLng
            }

            dispatch(setUserLocation(data))
            void updateLocation(data)
        }
    }, [geolocation.latitude, geolocation.longitude])

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
                        onClick={handleAddPlaceClick}
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
