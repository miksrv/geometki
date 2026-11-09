import { isKnownAnswer } from './visitQuestions'

describe('isKnownAnswer', () => {
    it('knows the questions and the features with yes/no', () => {
        expect(isKnownAnswer('road', 'dirt')).toBe(true)
        expect(isKnownAnswer('road', 'yes')).toBe(false)
        expect(isKnownAnswer('can_swim', 'yes')).toBe(true)
        expect(isKnownAnswer('can_swim', 'no')).toBe(true)
        expect(isKnownAnswer('can_swim', 'dirt')).toBe(false)
        expect(isKnownAnswer('can_unknown', 'yes')).toBe(false)
    })
})
