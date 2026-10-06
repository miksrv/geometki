import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { buildPlaceUrl, formatDate } from '@/utils/helpers'
import { getActivityTitle } from '@/utils/notifications'

import { NotificationIcon } from '../snackbar/NotificationIcon'

import styles from './styles.module.sass'

const NO_ICON_TYPES = new Set(['success', 'error', 'warning', 'info'])

export const NotificationListItem: React.FC<ApiModel.Notification> = (props) => {
    const { t } = useTranslation()

    const title = (() => {
        if (typeof props.title !== 'undefined') {
            return props.title
        }
        if (props.activity) {
            return getActivityTitle(props.activity, t)
        }
        return getActivityTitle(props.type, t)
    })()

    const content = (() => {
        if (props.type === 'experience') {
            return `+${props.meta?.value} ${t('notification_experience', { defaultValue: 'опыта' })}`
        }
        if (props.type === 'level') {
            return `${props.meta?.title} (${props.meta?.level})`
        }
        if (props.type === 'achievements') {
            return props.meta?.title ?? ''
        }
        if (props.place) {
            return (
                <Link
                    href={buildPlaceUrl(props.place.id, props.place.slug)}
                    title={props.place.title}
                >
                    {props.place.title}
                </Link>
            )
        }
        return props.message ?? ''
    })()

    const hideIcon = NO_ICON_TYPES.has(props.type ?? '')

    return (
        <div className={cn(styles.notifyItem, !props.read && styles.notifyItemUnread)}>
            {!hideIcon && (
                <div className={styles.notifyItemIcon}>
                    <NotificationIcon {...props} />
                </div>
            )}
            <div className={styles.notifyItemBody}>
                {!!title && <span className={styles.notifyItemTitle}>{title}</span>}
                {!!content && <span className={styles.notifyItemContent}>{content}</span>}
                <span className={styles.notifyItemDate}>{formatDate(props.created?.date, t('date-time-format'))}</span>
            </div>
        </div>
    )
}
