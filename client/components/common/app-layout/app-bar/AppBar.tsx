import React, { useEffect } from 'react'
import useGeolocation from 'react-hook-geolocation'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API, ApiType, useAppDispatch, useAppSelector } from '@/api'
import { openAuthDialog, setUserLocation } from '@/api/applicationSlice'
import { logout } from '@/api/authSlice'
import { round } from '@/functions/helpers'

import { AppAuthChecker } from './AppAuthChecker'
import { Logo } from './Logo'
import { NotificationList } from './NotificationList'
import { Search } from './Search'
import { UserMenu } from './UserMenu'

import styles from './styles.module.sass'

interface AppBarProps {
    fullSize?: boolean
    onMenuClick?: () => void
}

export const AppBar: React.FC<AppBarProps> = ({ fullSize, onMenuClick }) => {
    const { t } = useTranslation('components.app-bar')
    const dispatch = useAppDispatch()
    const geolocation = useGeolocation()

    const appAuth = useAppSelector((state) => state.auth)
    const userLocation = useAppSelector((state) => state.application.userLocation)

    const [updateLocation] = API.useLocationPutCoordinatesMutation()

    const handleLoginClick = (event: React.MouseEvent) => {
        event.preventDefault()
        dispatch(openAuthDialog())
    }

    const handleLogout = () => {
        dispatch(logout())
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
                <button
                    className={styles.hamburgerButton}
                    onClick={onMenuClick}
                    aria-label={'Toggle Sidebar'}
                >
                    <Icon name={'Menu'} />
                </button>

                <Logo />

                <Search />

                <div className={styles.rightSection}>
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
                            title={t('authorization-on-site_title', {
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
