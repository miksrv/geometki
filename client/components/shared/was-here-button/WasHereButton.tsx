import React, { useCallback, useEffect, useState } from 'react'
import { Button, Dialog } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import styles from './styles.module.sass'

const PENDING_VISITS_KEY = 'pending_visits'
const VISIT_TTL_MS = 86400000 // 24 hours

interface PendingVisit {
    placeId: string
    lat?: number
    lon?: number
    timestamp: number
}

interface WasHereButtonProps {
    placeId?: string
    verificationExempt?: boolean
}

export const WasHereButton: React.FC<WasHereButtonProps> = ({ placeId, verificationExempt }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [showGeoDialog, setShowGeoDialog] = useState(false)

    const [putVisit, { isLoading }] = API.useVisitedPutPlaceMutation()

    const { data: visitedData } = API.useVisitedCheckPlaceQuery({ placeId: placeId! }, { skip: !placeId || !isAuth })

    const callApi = useCallback(
        async (lat?: number, lon?: number) => {
            if (!placeId) {
                return
            }

            const result = await putVisit({ lat, lon, place: placeId }).unwrap()

            if (!result.visited) {
                void dispatch(
                    Notify({
                        id: 'visitedRemoved',
                        message: t('visited-removed'),
                        type: 'success'
                    })
                )
            } else if (result.verified) {
                void dispatch(
                    Notify({
                        id: 'visitedConfirmed',
                        message: t('visited-confirmed'),
                        type: 'success'
                    })
                )
            } else {
                void dispatch(
                    Notify({
                        id: 'visitedUnconfirmed',
                        message: t('visited-unconfirmed'),
                        type: 'success'
                    })
                )
            }
        },
        [dispatch, placeId, putVisit, t]
    )

    const savePendingVisit = useCallback(
        (lat?: number, lon?: number) => {
            if (!placeId) {
                return
            }

            const existing: PendingVisit[] = JSON.parse(localStorage.getItem(PENDING_VISITS_KEY) ?? '[]')
            const entry: PendingVisit = { lat, lon, placeId, timestamp: Date.now() }

            localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify([...existing, entry]))
        },
        [placeId]
    )

    const flushPendingVisits = useCallback(async () => {
        const now = Date.now()
        const pending: PendingVisit[] = JSON.parse(localStorage.getItem(PENDING_VISITS_KEY) ?? '[]')

        if (!pending.length) {
            return
        }

        const fresh = pending.filter((v) => now - v.timestamp < VISIT_TTL_MS)
        const stale = pending.filter((v) => now - v.timestamp >= VISIT_TTL_MS)

        if (stale.length) {
            localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(fresh))
        }

        const remaining: PendingVisit[] = []

        for (const visit of fresh) {
            try {
                await putVisit({ lat: visit.lat, lon: visit.lon, place: visit.placeId }).unwrap()
            } catch {
                remaining.push(visit)
            }
        }

        localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(remaining))
    }, [putVisit])

    useEffect(() => {
        const handleOnline = () => {
            void flushPendingVisits()
        }

        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('online', handleOnline)
        }
    }, [flushPendingVisits])

    const handleVisitClick = async () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        if (!navigator.onLine) {
            savePendingVisit()
            void dispatch(
                Notify({
                    id: 'visitedOffline',
                    message: t('visited-unconfirmed'),
                    type: 'success'
                })
            )
            return
        }

        if (verificationExempt) {
            void callApi()
            return
        }

        if (navigator.permissions) {
            const perm = await navigator.permissions.query({ name: 'geolocation' })

            if (perm.state === 'granted') {
                navigator.geolocation.getCurrentPosition(
                    (pos) => void callApi(pos.coords.latitude, pos.coords.longitude),
                    () => void callApi(),
                    { enableHighAccuracy: false, maximumAge: 60000, timeout: 3000 }
                )
                return
            }
        }

        setShowGeoDialog(true)
    }

    const handleDialogShareLocation = () => {
        setShowGeoDialog(false)

        if (!navigator.geolocation) {
            void callApi()
            return
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => void callApi(pos.coords.latitude, pos.coords.longitude),
            () => void callApi(),
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
        )
    }

    const handleDialogWithoutConfirmation = () => {
        setShowGeoDialog(false)
        void callApi()
    }

    return (
        <>
            <Button
                mode={visitedData?.result ? 'primary' : 'secondary'}
                size={'small'}
                className={styles.wasHereButton}
                disabled={!placeId || isLoading}
                loading={isLoading}
                label={t('visited-was-here')}
                onClick={() => void handleVisitClick()}
            />

            <Dialog
                open={showGeoDialog}
                onCloseDialog={() => setShowGeoDialog(false)}
            >
                <p className={styles.dialogDescription}>{t('visited-dialog-description')}</p>

                <div className={styles.dialogActions}>
                    <Button
                        mode={'primary'}
                        onClick={handleDialogShareLocation}
                    >
                        {t('visited-dialog-share-location')}
                    </Button>

                    <Button
                        mode={'secondary'}
                        onClick={handleDialogWithoutConfirmation}
                    >
                        {t('visited-dialog-without-confirmation')}
                    </Button>
                </div>
            </Dialog>
        </>
    )
}
