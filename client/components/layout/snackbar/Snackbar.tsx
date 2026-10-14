import React, { useEffect, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { deleteNotification, Notify, setReadNotification } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { Notification } from './Notification'

import styles from './styles.module.sass'

/** Toasts on screen at once; the rest wait in the queue and appear as these close */
export const MAX_VISIBLE_TOASTS = 4

const TOAST_DURATION_MS = 10_000
const ERROR_TOAST_DURATION_MS = 15_000

// Server notifications already turned into toasts. Module-level: survives remounts, and a poll
// that comes back before PATCH /notifications/read has landed does not show them a second time
const shownServerIds = new Set<string>()

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

    const { data } = API.useNotificationsGetUpdatesQuery(undefined, {
        pollingInterval: 15 * 1000,
        refetchOnMountOrArgChange: true,
        skip: !isAuth,
        skipPollingIfUnfocused: true
    })

    const handleCloseNotification = (id: string) => {
        dispatch(deleteNotification(id))
    }

    useEffect(() => {
        const fresh = data?.items?.filter(({ id }) => !shownServerIds.has(id)) ?? []

        if (!fresh.length) {
            return
        }

        fresh.forEach((item) => {
            shownServerIds.add(item.id)
            dispatch(Notify(item))
        })

        // A toast is how the user sees a new notification: once shown it is read
        void markRead({ ids: fresh.map(({ id }) => id) })
    }, [data, dispatch, markRead])

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
                    onLoad={(id) => {
                        if (!notification.read) {
                            setTimeout(() => {
                                dispatch(setReadNotification(id))
                            }, 500)
                        }
                    }}
                    {...notification}
                />
            ))}
        </div>
    )
}
