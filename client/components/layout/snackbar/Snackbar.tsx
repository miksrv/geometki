'use client'

import React, { useEffect } from 'react'

import { API, useAppDispatch, useAppSelector } from '@/api'
import { deleteNotification, Notify, setReadNotification, setUnreadCounter } from '@/api/notificationSlice'

import { Notification } from './Notification'

import styles from './styles.module.sass'

export const Snackbar: React.FC = () => {
    const dispatch = useAppDispatch()

    const notifications = useAppSelector((state) => state.notification.list)
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data } = API.useNotificationsGetUpdatesQuery(undefined, {
        pollingInterval: 15 * 1000,
        refetchOnMountOrArgChange: true,
        skip: !isAuth
    })

    const handleCloseNotification = (id: string) => {
        dispatch(deleteNotification(id))
    }

    useEffect(() => {
        data?.items?.forEach((item) => {
            void dispatch(Notify(item))
        })

        void dispatch(setUnreadCounter(data?.count ?? 0))
    }, [data])

    return (
        <div className={styles.snackbar}>
            {notifications.map((notification) => (
                <Notification
                    key={notification.id}
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
