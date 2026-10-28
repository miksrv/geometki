/**
 * Visit questions: a closed list like the categories. The keys and allowed values are on the server
 * (`server/app/Config/VisitQuestions.php`), the texts are `visitQuestions.<key>` in `common.json`.
 * A category has a pool of them; a visit is asked three, the ones the place does not know yet first
 * (`questions` of `GET /visits/me?place=`).
 */
export enum VisitQuestions {
    Road = 'road',
    Walk = 'walk',
    Trail = 'trail',
    Entry = 'entry',
    State = 'state',
    Water = 'water',
    Crowd = 'crowd',
    Time = 'time',
    Parking = 'parking',
    Cell = 'cell',
    Facilities = 'facilities',
    Safety = 'safety',
    Access = 'access'
}

export const VisitQuestionValues: Record<VisitQuestions, readonly string[]> = {
    [VisitQuestions.Road]: ['asphalt', 'dirt', 'offroad', 'foot', 'water'],
    [VisitQuestions.Walk]: ['short', 'medium', 'long'],
    [VisitQuestions.Trail]: ['marked', 'faint', 'none'],
    [VisitQuestions.Entry]: ['free', 'paid', 'guarded', 'outside', 'closed'],
    [VisitQuestions.State]: ['intact', 'decaying', 'demolished'],
    [VisitQuestions.Water]: ['present', 'dry'],
    [VisitQuestions.Crowd]: ['empty', 'some', 'crowded'],
    [VisitQuestions.Time]: ['hour', 'half', 'day'],
    [VisitQuestions.Parking]: ['near', 'far', 'none'],
    [VisitQuestions.Cell]: ['good', 'weak', 'none'],
    [VisitQuestions.Facilities]: ['none', 'basic', 'full'],
    [VisitQuestions.Safety]: ['safe', 'care', 'danger'],
    [VisitQuestions.Access]: ['full', 'partial', 'none']
}

/**
 * The features of a place ("What can you do here?"): yes/no facts, a closed list too. A feature is
 * stored as the question `can_<feature>` with the value `yes` or `no`; the texts are
 * `visitFeatures.<feature>`. The server sends up to five of them per category (`questions` of
 * `GET /visits/me?place=`, the last one: `{ key: 'can', features: [...] }`).
 */
export enum VisitFeatures {
    Swim = 'swim',
    Fish = 'fish',
    Raft = 'raft',
    Beach = 'beach',
    Camp = 'camp',
    Winter = 'winter',
    Ski = 'ski',
    Kids = 'kids',
    Dog = 'dog',
    Drink = 'drink',
    Fire = 'fire'
}

/** The key of the step of the features among the questions */
export const FEATURES_QUESTION = 'can'

/** The question key of a feature: `can_swim` */
export const FEATURE_PREFIX = 'can_'

export const FeatureAnswerValues: readonly string[] = ['yes', 'no']

/** `can_swim` → `swim`; undefined for any other question key */
export const featureOfQuestion = (question: string): string | undefined =>
    question.startsWith(FEATURE_PREFIX) ? question.slice(FEATURE_PREFIX.length) : undefined
