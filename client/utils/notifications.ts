import { TFunction } from 'i18next'

import { ApiModel } from '@/api'
import { ActivityType } from '@/api/types'

export const getActivityTitle = (type: ActivityType | undefined, t: TFunction): string => {
    switch (type) {
        case 'photo':
            return t('notification_photo', { defaultValue: 'Загружена новая фотография' })
        case 'place':
            return t('notification_place', { defaultValue: 'Добавлена новая геометка' })
        case 'rating':
            return t('notification_rating', { defaultValue: 'Поставлена новая оценка' })
        case 'edit':
            return t('notification_edit', { defaultValue: 'Отредактирована геометка' })
        case 'cover':
            return t('notification_cover', { defaultValue: 'Изменена обложка' })
        case 'bookmark':
            return t('notification_bookmark', { defaultValue: 'Геометка добавлена в закладки' })
        case 'visit':
            return t('notification_visit', { defaultValue: 'Отмечено посещение геометки' })
        case 'collection':
            return t('notification_collection', { defaultValue: 'Создана новая коллекция' })
        case 'collection_place':
            return t('notification_collection_place', { defaultValue: 'Ваше место добавлено в коллекцию' })
        case 'level':
            return t('notification_level', { defaultValue: 'Новый уровень!' })
        case 'achievements':
            return t('notification_achievements', { defaultValue: 'Новое достижение' })
        case 'warning':
            return t('notification_warning', { defaultValue: 'Предупреждение' })
        case 'error':
            return t('notification_error', { defaultValue: 'Ошибка' })
        case undefined:
        case 'info':
        case 'experience':
        case 'success':
        default:
            return ''
    }
}

/**
 * Heading of a notification, the same in a toast and in the list under the bell: an explicit
 * `title`, else what happened (the activity, or the notification type). An experience toast
 * adds the XP it brought: "Поставлена новая оценка +5 XP".
 */
export const getNotificationTitle = (notification: ApiModel.Notification, t: TFunction): string => {
    if (typeof notification.title !== 'undefined') {
        return notification.title
    }

    if (notification.type === 'experience') {
        const xpLabel = notification.meta?.value != null ? `+${notification.meta.value} XP` : ''

        return [getActivityTitle(notification.activity, t), xpLabel].filter(Boolean).join(' ')
    }

    return getActivityTitle(notification.activity ?? notification.type, t)
}

/**
 * Plain-text body of a notification about the user (experience, level, achievement) or a
 * message of the client itself. Notifications about a place or collection link to it instead,
 * so they have no text here.
 */
export const getNotificationText = (notification: ApiModel.Notification, t: TFunction): string => {
    const { meta, type } = notification

    if (type === 'experience') {
        return `+${meta?.value ?? 0} ${t('notification_experience', { defaultValue: 'опыта' })}`
    }

    if (type === 'level') {
        return `${meta?.title ?? ''} (${meta?.level ?? ''})`
    }

    if (type === 'achievements') {
        return meta?.title ?? ''
    }

    return notification.message ?? ''
}
