import { SizeType } from './types'

const DIMENSIONS: Record<SizeType, number> = { large: 56, medium: 36, small: 20, tiny: 28 }

export const getDimension = (size?: SizeType) => DIMENSIONS[size ?? 'small']

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
