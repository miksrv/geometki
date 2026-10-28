import { answerTexts, isKnownAnswer } from './visitQuestions'

const t = (key: string, options?: Record<string, unknown>) => (options?.list ? `${key}|${String(options.list)}` : key)

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

describe('answerTexts', () => {
    it('lists the ordinary values, then the features that can and cannot be done', () => {
        expect(
            answerTexts({ can_fire: 'no', can_fish: 'yes', can_swim: 'yes', road: 'dirt', wrong: 'x' }, t)
        ).toStrictEqual([
            'visitQuestions.road.values.dirt',
            'visit-answers-can|visitFeatures.fish, visitFeatures.swim',
            'visit-answers-cannot|visitFeatures.fire'
        ])
    })
})
