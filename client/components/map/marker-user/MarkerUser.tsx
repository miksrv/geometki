import React, { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import Leaflet from 'leaflet'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { CopyCoordinates } from '@/components/shared/copy-coordinates'
import { UserAvatar } from '@/components/shared/user-avatar'
import { IMG_HOST } from '@/config/env'
import userAvatar from '@/public/images/no-avatar.png'

import styles from './styles.module.sass'

const ICON_SIZE = 36

interface MarkerUserProps {
    coordinates: ApiType.Coordinates
}

/**
 * The visitor on the map: their avatar in a circle (the placeholder for a guest or a user
 * without one), with a popup showing who it is and where.
 */
export const MarkerUser: React.FC<MarkerUserProps> = ({ coordinates }) => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const user = useAppSelector((state) => state.auth.user)

    const avatar = isAuth && user?.avatar ? `${IMG_HOST}${user.avatar}` : userAvatar.src

    const icon = useMemo(() => {
        const image = document.createElement('img')
        image.src = avatar
        image.alt = ''

        return new Leaflet.DivIcon({
            className: styles.markerUser,
            html: image.outerHTML,
            iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
            iconSize: [ICON_SIZE, ICON_SIZE],
            popupAnchor: [0, -ICON_SIZE / 2]
        })
    }, [avatar])

    return (
        <Marker
            position={[coordinates.lat, coordinates.lon]}
            icon={icon}
            title={t('my-location', { defaultValue: 'Моё местоположение' })}
        >
            <Popup className={styles.markerUserPopup}>
                <div className={styles.label}>{t('my-location', { defaultValue: 'Моё местоположение' })}</div>

                <UserAvatar
                    user={isAuth ? user : undefined}
                    size={'medium'}
                    showName={true}
                    hideOnlineIcon={true}
                    caption={
                        isAuth && user?.levelData?.level
                            ? t('level_num', { defaultValue: 'Уровень {{level}}', level: user.levelData.level })
                            : undefined
                    }
                />

                <div className={styles.coordinates}>
                    <CopyCoordinates
                        lat={coordinates.lat}
                        lon={coordinates.lon}
                    />
                </div>
            </Popup>
        </Marker>
    )
}
