import React, { useCallback, useEffect, useState } from 'react'
import { Button, cn, Dialog } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { NotifyReplace } from '@/app/notificationSlice'
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
    size?: 'small' | 'medium' | 'large'
    /** Icon only, the label goes to the tooltip (the phone actions bar) */
    hideLabel?: boolean
    stretched?: boolean
    className?: string
}

/**
 * "Я здесь был(а)": marks the visit, with the location when the visitor shares it. A
 * marked visit turns the button green (success tint), the same in every place it is shown.
 */
export const WasHereButton: React.FC<WasHereButtonProps> = ({
    placeId,
    verificationExempt,
    size = 'small',
    hideLabel,
    stretched,
    className
}) => {
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
                    NotifyReplace({
                        id: 'visited',
                        message: t('visited-removed'),
                        type: 'success'
                    })
                )
            } else if (result.verified) {
                void dispatch(
                    NotifyReplace({
                        id: 'visited',
                        message: t('visited-confirmed'),
                        type: 'success'
                    })
                )
            } else {
                void dispatch(
                    NotifyReplace({
                        id: 'visited',
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

        // The page has several of these buttons, each one listens for `online`: the first to run
        // takes the queue synchronously, the others find it empty — a visit is a toggle, sent once
        localStorage.setItem(PENDING_VISITS_KEY, '[]')

        const fresh = pending.filter((v) => now - v.timestamp < VISIT_TTL_MS)
        const remaining: PendingVisit[] = []

        for (const visit of fresh) {
            try {
                await putVisit({ lat: visit.lat, lon: visit.lon, place: visit.placeId }).unwrap()
            } catch {
                remaining.push(visit)
            }
        }

        // Visits saved offline while these were being sent stay in the queue too
        const added: PendingVisit[] = JSON.parse(localStorage.getItem(PENDING_VISITS_KEY) ?? '[]')

        localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify([...added, ...remaining]))
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
                NotifyReplace({
                    id: 'visited',
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
                mode={'secondary'}
                size={size}
                icon={'CheckCircle'}
                stretched={stretched}
                className={cn(styles.wasHereButton, visitedData?.result && styles.visited, className)}
                disabled={!placeId || isLoading}
                loading={isLoading}
                label={hideLabel ? undefined : t('visited-was-here')}
                tooltip={hideLabel ? t('visited-was-here') : undefined}
                aria-pressed={!!visitedData?.result}
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
