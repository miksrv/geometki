import { levelProgress } from './levels'

describe('levelProgress', () => {
    it('starts the bar from zero on a new level', () => {
        expect(levelProgress({ experience: 500, level: 5, levelExperience: 500, nextLevel: 750 })).toEqual({
            gained: 0,
            isMaxLevel: false,
            left: 250,
            percent: 0,
            required: 250
        })
    })

    it('counts the experience within the current level', () => {
        expect(levelProgress({ experience: 510, level: 5, levelExperience: 500, nextLevel: 750 })).toEqual({
            gained: 10,
            isMaxLevel: false,
            left: 240,
            percent: 4,
            required: 250
        })
    })

    it('does not go over the next level', () => {
        expect(levelProgress({ experience: 800, level: 5, levelExperience: 500, nextLevel: 750 })).toMatchObject({
            gained: 250,
            left: 0,
            percent: 100
        })
    })

    it('fills the bar on the last level', () => {
        expect(levelProgress({ experience: 48210, level: 30, levelExperience: 47500, nextLevel: null })).toEqual({
            gained: 710,
            isMaxLevel: true,
            left: 0,
            percent: 100
        })
    })

    it('counts from zero without the start of the level', () => {
        expect(levelProgress({ experience: 30, level: 1, nextLevel: 75 })).toMatchObject({
            gained: 30,
            percent: 40,
            required: 75
        })
    })

    it('leaves the bar empty without level data', () => {
        expect(levelProgress(undefined)).toEqual({ gained: 0, isMaxLevel: false, left: 0, percent: 0 })
    })
})
