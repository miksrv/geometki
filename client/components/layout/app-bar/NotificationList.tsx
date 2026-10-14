import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Popout, Spinner } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { deleteAllNotifications, Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Notification } from '@/components/layout/snackbar'
import { Counter } from '@/components/ui'

import styles from './styles.module.sass'

// Load the next page when the list is scrolled this close to its end, px
const LOAD_MORE_THRESHOLD = 20

export const NotificationList: React.FC = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [open, setOpen] = useState<boolean>(false)

    // Ids already sent to PATCH /notifications/read, so a re-render does not send them again
    const markedRead = useRef<Set<string>>(new Set())

    const [clearNotifications, { isLoading: clearLoading }] = API.useNotificationsDeleteMutation()
    const [markRead] = API.useNotificationsPatchReadMutation()

    // Reads from the cache already held by Snackbar — no extra network request
    const { data: updatesData } = API.useNotificationsGetUpdatesQuery(undefined, { skip: !isAuth })
    const unreadCount = updatesData?.count ?? 0

    // Every opening starts from the newest page: the list is refetched, not taken from the cache
    const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } =
        API.useNotificationsGetListInfiniteQuery(undefined, { refetchOnMountOrArgChange: true, skip: !open })

    const items = useMemo(() => data?.pages.flatMap((page) => page.items ?? []) ?? [], [data])

    // What the user has seen in the open list is read; the rows keep their highlight until it is opened again
    useEffect(() => {
        if (!open || isFetching) {
            return
        }

        const unseen = items.filter(({ id, read }) => !read && !markedRead.current.has(id)).map(({ id }) => id)

        if (unseen.length) {
            unseen.forEach((id) => markedRead.current.add(id))
            void markRead({ ids: unseen })
        }
    }, [open, isFetching, items, markRead])

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = event.currentTarget

        if (hasNextPage && !isFetchingNextPage && scrollTop + clientHeight >= scrollHeight - LOAD_MORE_THRESHOLD) {
            void fetchNextPage()
        }
    }

    const handleClearNotificationsClick = async () => {
        try {
            await clearNotifications().unwrap()

            dispatch(deleteAllNotifications())
            dispatch(
                Notify({
                    id: 'clearNotification',
                    message: t('notification-list-has-been-cleared', { defaultValue: 'Список уведомлений очищен' }),
                    title: '',
                    type: 'success'
                })
            )
        } catch {
            dispatch(
                Notify({
                    id: 'clearNotificationError',
                    message: t('notification-list-clear-error', { defaultValue: 'Не удалось очистить уведомления' }),
                    title: '',
                    type: 'error'
                })
            )
        }
    }

    return (
        <Popout
            onOpenChange={setOpen}
            trigger={
                // The badge sits next to an icon-only button, not inside it: a child would turn the
                // square icon button into a padded text button that widens with the number
                <span className={styles.notifyTrigger}>
                    <Button
                        aria-label={t('notifications', { defaultValue: 'Уведомления' })}
                        tooltip={t('notifications', { defaultValue: 'Уведомления' })}
                        mode={'outline'}
                        icon={'Bell'}
                        size={'medium'}
                    />
                    {unreadCount > 0 && (
                        <Counter
                            className={styles.notifyCounter}
                            value={unreadCount}
                            max={99}
                        />
                    )}
                </span>
            }
        >
            <div className={styles.notifyPopup}>
                {!!items.length && (
                    <div
                        className={styles.notificationsContent}
                        onScroll={handleScroll}
                    >
                        {items.map((item) => (
                            <Notification
                                key={item.id}
                                variant={'list'}
                                {...item}
                            />
                        ))}

                        {isFetchingNextPage && (
                            <div className={styles.loadingMore}>
                                <Spinner />
                            </div>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div className={styles.loader}>
                        <Spinner />
                    </div>
                )}

                {!items.length && !isLoading && (
                    <div className={styles.noData}>
                        <p>{t('no-notifications', { defaultValue: 'Нет уведомлений' })}</p>
                    </div>
                )}

                <div className={styles.notifyFooter}>
                    <Button
                        size={'small'}
                        mode={'secondary'}
                        label={t('clear_button', { defaultValue: 'Очистить список' })}
                        style={{ width: '100%' }}
                        disabled={clearLoading || isFetching || !items.length}
                        loading={clearLoading}
                        onClick={handleClearNotificationsClick}
                    />
                </div>
            </div>
        </Popout>
    )
}
