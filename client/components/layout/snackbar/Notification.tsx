import React, { useEffect } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { LevelProgress } from '@/components/shared/level-progress/LevelProgress'
import { buildPlaceUrl, formatDate } from '@/utils/helpers'
import { getActivityTitle } from '@/utils/notifications'

import { NotificationIcon } from './NotificationIcon'

import styles from './styles.module.sass'

interface NotificationProps extends ApiModel.Notification {
    showDate?: boolean
    onClose?: (id: string) => void
    onLoad?: (id: string) => void
}

const NO_ICON_TYPES = new Set(['success', 'error', 'warning', 'info', 'level', 'experience'])

export const Notification: React.FC<NotificationProps> = ({ showDate, onClose, onLoad, ...props }) => {
    const { t } = useTranslation()

    useEffect(() => {
        onLoad?.(props.id)
    }, [])

    const hideIcon = NO_ICON_TYPES.has(props.type ?? '')

    const resolvedTitle = (() => {
        if (typeof props.title !== 'undefined') {
            return props.title
        }
        if (props.type === 'experience') {
            const activityLabel = getActivityTitle(props.activity, t)
            const xpLabel = props.meta?.value != null ? `+${props.meta.value} XP` : ''
            return [activityLabel, xpLabel].filter(Boolean).join(' ')
        }
        if (props.activity) {
            return getActivityTitle(props.activity, t)
        }
        if (props.type && props.type !== 'success') {
            return getActivityTitle(props.type, t)
        }
        return ''
    })()

    return (
        <div className={cn(styles.notification, styles[props.type!], !props.read && styles.unread)}>
            {!hideIcon && (
                <div className={styles.before}>
                    <NotificationIcon {...props} />
                </div>
            )}
            <div className={styles.body}>
                {!!resolvedTitle && <span className={styles.title}>{resolvedTitle}</span>}
                {props.type === 'experience' && props.meta?.experience != null && props.meta?.nextLevel != null ? (
                    <LevelProgress
                        levelData={{
                            level: props.meta.level,
                            experience: props.meta.experience,
                            nextLevel: props.meta.nextLevel
                        }}
                        badgeSize={18}
                    />
                ) : (
                    <span className={styles.content}>
                        {props.message}
                        {props.type === 'experience' ? (
                            `+${props.meta?.value} ${t('notification_experience', { defaultValue: 'опыт' })}`
                        ) : props.type === 'level' ? (
                            `${props.meta?.title} (${props.meta?.level})`
                        ) : props.type === 'achievements' ? (
                            <span>{props.meta?.title ?? ''}</span>
                        ) : props.place ? (
                            <Link
                                href={buildPlaceUrl(props.place.id, props.place.slug)}
                                title={props.place.title}
                            >
                                {props.place.title}
                            </Link>
                        ) : (
                            <></>
                        )}
                    </span>
                )}
                {showDate && (
                    <div className={styles.datetime}>{formatDate(props.created?.date, t('date-time-format'))}</div>
                )}
            </div>
            {onClose && (
                <button
                    className={styles.closeButton}
                    aria-label={t('close')}
                    onClick={() => onClose(props.id)}
                >
                    <Icon name={'Close'} />
                </button>
            )}
        </div>
    )
}
