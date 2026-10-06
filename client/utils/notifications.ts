import { TFunction } from 'i18next'

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
