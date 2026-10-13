import { useCallback, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { setUserLocation } from '@/app/applicationSlice'
import { NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { roundLocation } from '@/utils/userLocation'

const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }

const isGranted = async (): Promise<boolean> => {
    try {
        return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted'
    } catch {
        return false
    }
}

/**
 * The visitor's location. The browser is asked only from `request()`, which is called on the
 * visitor's own action (the map's "My location" button, sorting by distance): never on page load.
 * `refresh()` updates an already known location silently, and only when the permission has been
 * granted before, so it never shows the browser prompt.
 *
 * The location goes to the store and the cookie (utils/userLocation.ts); for a signed-in user it
 * is also sent to the server, which keeps the last point (PUT /location) when it has changed.
 */
const useUserLocation = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const location = useAppSelector((state) => state.application.userLocation)

    const [updateLocation] = API.useLocationPutCoordinatesMutation()
    const [loading, setLoading] = useState<boolean>(false)

    const save = useCallback(
        (position: GeolocationPosition): ApiType.Coordinates => {
            const coordinates = roundLocation(position.coords.latitude, position.coords.longitude)

            if (coordinates.lat !== location?.lat || coordinates.lon !== location?.lon) {
                dispatch(setUserLocation(coordinates))

                if (isAuth === true) {
                    void updateLocation(coordinates)
                }
            }

            return coordinates
        },
        [dispatch, isAuth, location?.lat, location?.lon, updateLocation]
    )

    const locate = useCallback(
        (silent: boolean): Promise<ApiType.Coordinates | undefined> =>
            new Promise((resolve) => {
                const fail = (error?: GeolocationPositionError) => {
                    setLoading(false)

                    if (!silent) {
                        void dispatch(
                            NotifyReplace({
                                id: 'user-location',
                                message:
                                    error?.code === 1 // PERMISSION_DENIED
                                        ? t('my-location-denied')
                                        : t('my-location-unavailable'),
                                type: 'error'
                            })
                        )
                    }

                    resolve(undefined)
                }

                if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    fail()
                    return
                }

                // A silent refresh does not hold the button: the visitor did not ask for it
                if (!silent) {
                    setLoading(true)
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setLoading(false)
                        resolve(save(position))
                    },
                    fail,
                    POSITION_OPTIONS
                )
            }),
        [dispatch, save, t]
    )

    const request = useCallback(() => locate(false), [locate])

    const refresh = useCallback(async () => {
        if (await isGranted()) {
            await locate(true)
        }
    }, [locate])

    return { loading, location, refresh, request }
}

export default useUserLocation
