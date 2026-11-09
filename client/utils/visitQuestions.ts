import { FeatureAnswerValues, featureOfQuestion, VisitFeatures, VisitQuestionValues } from '@/api/models/visitQuestion'

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
