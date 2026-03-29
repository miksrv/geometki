import { SizeType } from './types'

export const getDimension = (size?: SizeType) => (size === 'medium' ? 36 : size === 'tiny' ? 32 : 20)

/**
 * Получает инициалы из имени пользователя (первые буквы первых двух слов)
 */
export const getInitials = (name?: string): string => {
    if (!name) {
        return '?'
    }

    const words = name.trim().split(/\s+/)
    const initials = words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('')

    return initials || '?'
}
