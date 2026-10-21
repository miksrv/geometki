import React, { useEffect, useRef, useState } from 'react'
import { cn, Icon, Tooltip } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { LevelProgress } from '@/components/shared/level-progress/LevelProgress'
import { buildCollectionUrl, buildPlaceUrl, formatDate } from '@/utils/helpers'
import { getNotificationText, getNotificationTitle } from '@/utils/notifications'

import { NotificationIcon } from './NotificationIcon'

import styles from './styles.module.sass'

interface NotificationProps extends ApiModel.Notification {
    /** `toast` — a snackbar toast; `list` — a row of the list under the bell, with the date */
    variant?: 'toast' | 'list'
    /** Toast: close after this many ms on screen; hovering or focusing the toast pauses the countdown */
    autoDismissMs?: number
    /** Toast: hold the countdown (e.g. while the browser tab is hidden) */
    paused?: boolean
    onClose?: (id: string) => void
    onLoad?: (id: string) => void
}

// Notifications about the user themselves: their text says it all, no place or collection link
const ABOUT_USER_TYPES = new Set(['experience', 'level', 'achievements'])

const NO_ICON_TYPES: Record<NonNullable<NotificationProps['variant']>, Set<string>> = {
    list: new Set(['success', 'error', 'warning', 'info']),
    toast: new Set(['success', 'error', 'warning', 'info', 'level', 'experience'])
}

export const Notification: React.FC<NotificationProps> = ({
    variant = 'toast',
    autoDismissMs,
    paused,
    onClose,
    onLoad,
    ...props
}) => {
    const { t } = useTranslation()

    const [hovered, setHovered] = useState<boolean>(false)
    const [focused, setFocused] = useState<boolean>(false)
    const remainingMs = useRef<number>(autoDismissMs ?? 0)

    useEffect(() => {
        onLoad?.(props.id)
    }, [])

    // The countdown runs only while nobody is reading the toast (WCAG 2.2.1)
    const countdownPaused = !!paused || hovered || focused

    useEffect(() => {
        if (!autoDismissMs || !onClose || countdownPaused) {
            return
        }

        const startedAt = Date.now()
        const timer = setTimeout(() => onClose(props.id), Math.max(0, remainingMs.current))

        return () => {
            clearTimeout(timer)
            remainingMs.current -= Date.now() - startedAt
        }
    }, [countdownPaused])

    const title = getNotificationTitle(props, t)
    const text = getNotificationText(props, t)
    const showLevelProgress =
        variant === 'toast' &&
        props.type === 'experience' &&
        props.meta?.experience != null &&
        // nextLevel is null on the last level: the bar is full then
        props.meta?.levelExperience != null

    const link = ABOUT_USER_TYPES.has(props.type ?? '') ? null : props.collection ? (
        <Link
            href={buildCollectionUrl(props.collection.id, props.collection.slug)}
            title={props.collection.title}
        >
            {props.collection.title}
        </Link>
    ) : props.place ? (
        <Link
            href={buildPlaceUrl(props.place.id, props.place.slug)}
            title={props.place.title}
        >
            {props.place.title}
        </Link>
    ) : null

    return (
        <div
            className={cn(
                styles.notification,
                styles[variant],
                props.type && styles[props.type],
                !props.read && styles.unread
            )}
            // An error interrupts; anything else waits for the screen reader to finish (the snackbar is a polite live region)
            role={variant === 'toast' && props.type === 'error' ? 'alert' : undefined}
            onMouseEnter={variant === 'toast' ? () => setHovered(true) : undefined}
            onMouseLeave={variant === 'toast' ? () => setHovered(false) : undefined}
            onFocus={variant === 'toast' ? () => setFocused(true) : undefined}
            onBlur={variant === 'toast' ? () => setFocused(false) : undefined}
        >
            {!NO_ICON_TYPES[variant].has(props.type ?? '') && (
                <div className={styles.before}>
                    <NotificationIcon {...props} />
                </div>
            )}
            <div className={styles.body}>
                {!!title && <span className={styles.title}>{title}</span>}
                {showLevelProgress ? (
                    <LevelProgress
                        levelData={{
                            experience: props.meta?.experience,
                            level: props.meta?.level,
                            levelExperience: props.meta?.levelExperience,
                            nextLevel: props.meta?.nextLevel
                        }}
                        badgeSize={18}
                    />
                ) : (
                    (!!text || !!link) && (
                        <span className={styles.content}>
                            {text}
                            {link}
                        </span>
                    )
                )}
                {variant === 'list' && (
                    <span className={styles.datetime}>{formatDate(props.created?.date, t('date-time-format'))}</span>
                )}
            </div>
            {onClose && (
                <Tooltip content={t('close', { defaultValue: 'Закрыть' })}>
                    <button
                        type={'button'}
                        className={styles.closeButton}
                        aria-label={t('close', { defaultValue: 'Закрыть' })}
                        onClick={() => onClose(props.id)}
                    >
                        <Icon name={'Close'} />
                    </button>
                </Tooltip>
            )}
        </div>
    )
}
