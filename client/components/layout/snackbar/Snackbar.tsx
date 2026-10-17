import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { deleteNotification, Notify, setReadNotification, SnackbarNotification } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { Notification } from './Notification'

import styles from './styles.module.sass'

/** Toasts on screen at once; the rest wait in the queue and appear as these close */
export const MAX_VISIBLE_TOASTS = 4

const TOAST_DURATION_MS = 10_000
const ERROR_TOAST_DURATION_MS = 15_000

// Module-level, so they survive remounts of the Snackbar:
// server notifications already queued as toasts — a poll that comes back before they are marked read
// does not queue them a second time
const queuedServerIds = new Set<string>()
// toasts of server notifications already on screen but not yet confirmed read by the API
const unconfirmedReadIds = new Set<string>()
// ids of a PATCH /notifications/read still in flight
const inFlightReadIds = new Set<string>()

const usePageHidden = (): boolean => {
    const [hidden, setHidden] = useState<boolean>(false)

    useEffect(() => {
        const onChange = () => setHidden(document.visibilityState === 'hidden')

        onChange()
        document.addEventListener('visibilitychange', onChange)

        return () => document.removeEventListener('visibilitychange', onChange)
    }, [])

    return hidden
}

export const Snackbar: React.FC = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const notifications = useAppSelector((state) => state.notification.list)
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    // Toasts wait while the tab is in the background instead of expiring unseen
    const pageHidden = usePageHidden()

    const [markRead] = API.useNotificationsPatchReadMutation()

    const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const { data, fulfilledTimeStamp } = API.useNotificationsGetUpdatesQuery(undefined, {
        pollingInterval: 60 * 1000,
        refetchOnMountOrArgChange: true,
        skip: !isAuth,
        skipPollingIfUnfocused: true
    })

    const handleCloseNotification = (id: string) => {
        dispatch(deleteNotification(id))
    }

    // A toast is how the user sees a new notification: it is read once it is on screen, not when it is
    // queued behind others. A failed request leaves the ids unconfirmed, and the next poll retries them
    const flushRead = useCallback(() => {
        const ids = [...unconfirmedReadIds].filter((id) => !inFlightReadIds.has(id))

        if (!ids.length) {
            return
        }

        ids.forEach((id) => inFlightReadIds.add(id))

        markRead({ ids })
            .unwrap()
            .then(() => ids.forEach((id) => unconfirmedReadIds.delete(id)))
            .catch(() => undefined)
            .finally(() => ids.forEach((id) => inFlightReadIds.delete(id)))
    }, [markRead])

    // Toasts mounted in one render go in one request
    const scheduleFlushRead = useCallback(() => {
        flushTimer.current ??= setTimeout(() => {
            flushTimer.current = undefined
            flushRead()
        }, 0)
    }, [flushRead])

    useEffect(() => () => clearTimeout(flushTimer.current), [])

    useEffect(() => {
        data?.items?.forEach((item) => {
            if (!queuedServerIds.has(item.id)) {
                queuedServerIds.add(item.id)
                dispatch(Notify(item))
            }
        })

        flushRead()
    }, [data, fulfilledTimeStamp, dispatch, flushRead])

    const handleLoad = (notification: SnackbarNotification) => {
        if (queuedServerIds.has(notification.id)) {
            unconfirmedReadIds.add(notification.id)
            scheduleFlushRead()
        }

        if (!notification.read) {
            setTimeout(() => {
                dispatch(setReadNotification(notification.id))
            }, 500)
        }
    }

    return (
        <div
            className={styles.snackbar}
            role={'region'}
            aria-label={t('notifications', { defaultValue: 'Уведомления' })}
            aria-live={'polite'}
        >
            {notifications.slice(0, MAX_VISIBLE_TOASTS).map((notification) => (
                <Notification
                    // A replaced toast (NotifyReplace) remounts: its entrance and timer start over
                    key={`${notification.id}:${notification.revision ?? 0}`}
                    autoDismissMs={notification.type === 'error' ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS}
                    paused={pageHidden}
                    onClose={handleCloseNotification}
                    onLoad={() => handleLoad(notification)}
                    {...notification}
                />
            ))}
        </div>
    )
}
