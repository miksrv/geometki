import { LEVEL_COLORS } from '@/config/constants'
import en from '@/public/locales/en/common.json'
import ru from '@/public/locales/ru/common.json'

import { levelTier } from './levels'

describe('level tiers', () => {
    it('has a name for every tier in both locales', () => {
        const keys = LEVEL_COLORS.map((_, index) => String(index))

        expect(Object.keys(ru.levelTier)).toEqual(keys)
        expect(Object.keys(en.levelTier)).toEqual(keys)
    })

    it('puts every three levels into one tier, the last one holding the rest', () => {
        expect(levelTier(undefined)).toBe(0)
        expect(levelTier(3)).toBe(0)
        expect(levelTier(4)).toBe(1)
        expect(levelTier(99)).toBe(LEVEL_COLORS.length - 1)
    })
})
