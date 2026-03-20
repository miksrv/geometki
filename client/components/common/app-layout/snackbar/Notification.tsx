import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { formatDate } from '@/utils/helpers'

import { NotificationIcon } from './NotificationIcon'

import styles from './styles.module.sass'

interface NotificationProps extends ApiModel.Notification {
    showDate?: boolean
    onClose?: (id: string) => void
    onLoad?: (id: string) => void
}

export const Notification: React.FC<NotificationProps> = ({ showDate, onClose, onLoad, ...props }) => {
    const { t } = useTranslation('components.app-layout.snackbar')

    React.useEffect(() => {
        onLoad?.(props.id)
    }, [])

    return (
        <div
            className={cn(
                styles.notification,
                styles[props.type!],
                !props.read && styles.unread,
                typeof props.title !== 'undefined' && !props.title?.length ? styles.noTitle : ''
            )}
        >
            <div className={cn(styles.before)}>
                <NotificationIcon {...props} />
            </div>
            <div className={styles.body}>
                <span className={styles.title}>
                    {typeof props.title !== 'undefined'
                        ? props.title
                        : props.type === 'experience'
                          ? props.activity
                              ? t(`notification_${props.activity}`)
                              : ''
                          : props.type
                            ? t(props.type)
                            : ''}
                </span>
                <span className={styles.content}>
                    {props.message}
                    {props.type === 'experience' ? (
                        `+${props.meta?.value} ${t('notification_experience', { defaultValue: 'опыт' })}`
                    ) : props.type === 'level' ? (
                        `${props.meta?.title} (${props.meta?.level})`
                    ) : props.type === 'achievements' ? (
                        '' // TODO
                    ) : props.place ? (
                        <Link
                            href={`/places/${props.place.id}`}
                            title={''}
                        >
                            {props.place.title}
                        </Link>
                    ) : (
                        <></>
                    )}
                </span>
                {showDate && (
                    <div className={styles.datetime}>
                        {formatDate(props.created?.date, t('date_time_format', { defaultValue: 'D MMMM YYYY, HH:mm' }))}
                    </div>
                )}
            </div>
            {onClose && (
                <button
                    className={styles.closeButton}
                    onClick={() => onClose(props.id)}
                >
                    <Icon name={'Close'} />
                </button>
            )}
        </div>
    )
}
