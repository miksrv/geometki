import { useCallback, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'

export interface PrecisePosition {
    lat: number
    lon: number
    /** Metres, as the browser reports it */
    accuracy?: number
}

// A fresh fix from the GPS: "I am here" is told on the spot, a position of a minute ago may be another street
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }

// Asked along with "Я здесь был(а)": the visit does not wait long for a position it can do without
const QUIET_TIMEOUT = 7_000

interface RequestOptions {
    /**
     * The position is a bonus, not the point of the tap ("Я здесь был(а)" is a visit with or
     * without it): no toast when it is refused or not found, and a shorter wait
     */
    quiet?: boolean
}

/**
 * The visitor's exact position for a check-in on the spot (the game): asked once per tap, handed to the
 * caller and forgotten — it goes neither to the store nor to the cookie nor to the profile
 * (unlike `useUserLocation`, which keeps a rounded point for the distances). The server
 * compares it with the place and drops it too.
 */
const usePreciseLocation = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [loading, setLoading] = useState<boolean>(false)

    const request = useCallback(
        ({ quiet }: RequestOptions = {}): Promise<PrecisePosition | undefined> =>
            new Promise((resolve) => {
                const fail = (error?: GeolocationPositionError) => {
                    setLoading(false)

                    if (quiet) {
                        resolve(undefined)
                        return
                    }

                    void dispatch(
                        NotifyReplace({
                            id: 'precise-location',
                            message:
                                error?.code === 1 // PERMISSION_DENIED
                                    ? t('game-here-denied')
                                    : t('game-here-unavailable'),
                            type: 'error'
                        })
                    )

                    resolve(undefined)
                }

                if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    fail()
                    return
                }

                setLoading(true)

                navigator.geolocation.getCurrentPosition(
                    ({ coords }) => {
                        setLoading(false)
                        resolve({
                            accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : undefined,
                            lat: coords.latitude,
                            lon: coords.longitude
                        })
                    },
                    fail,
                    quiet ? { ...POSITION_OPTIONS, timeout: QUIET_TIMEOUT } : POSITION_OPTIONS
                )
            }),
        [dispatch, t]
    )

    return { loading, request }
}

export default usePreciseLocation
