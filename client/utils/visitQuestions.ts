import { FeatureAnswerValues, featureOfQuestion, VisitFeatures, VisitQuestionValues } from '@/api/models/visitQuestion'

type Translate = (key: string, options?: Record<string, unknown>) => string

/** A feature of the closed list */
export const isKnownFeature = (feature?: string): boolean =>
    !!feature && (Object.values(VisitFeatures) as string[]).includes(feature)

/** The question and value are in the closed list (a feature: `can_<feature>` with `yes`/`no`): only those have texts */
export const isKnownAnswer = (key: string, value: string): boolean => {
    const feature = featureOfQuestion(key)

    if (feature !== undefined) {
        return isKnownFeature(feature) && FeatureAnswerValues.includes(value)
    }

    return (VisitQuestionValues as Record<string, readonly string[] | undefined>)[key]?.includes(value) ?? false
}

/** The names of the features with the answer (`yes` or `no`) in the order of the answers: "купаться" */
export const featureTexts = (
    answers: Record<string, string> | undefined,
    value: 'yes' | 'no',
    t: Translate
): string[] =>
    Object.entries(answers ?? {})
        .filter(
            ([key, answer]) => answer === value && isKnownAnswer(key, answer) && featureOfQuestion(key) !== undefined
        )
        .map(([key]) => t(`visitFeatures.${featureOfQuestion(key)}`))

/**
 * The texts of the answers of a visit: the ordinary values in their order, then "можно: …" and
 * "нельзя: …" with the features; unknown keys and values skipped
 */
export const answerTexts = (answers: Record<string, string> | undefined, t: Translate): string[] => {
    const texts = Object.entries(answers ?? {})
        .filter(([key, value]) => featureOfQuestion(key) === undefined && isKnownAnswer(key, value))
        .map(([key, value]) => t(`visitQuestions.${key}.values.${value}`))

    const can = featureTexts(answers, 'yes', t)
    const cannot = featureTexts(answers, 'no', t)

    if (can.length) {
        texts.push(t('visit-answers-can', { list: can.join(', ') }))
    }

    if (cannot.length) {
        texts.push(t('visit-answers-cannot', { list: cannot.join(', ') }))
    }

    return texts
}
