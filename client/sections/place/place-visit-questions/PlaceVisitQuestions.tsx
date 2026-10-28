import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { FEATURE_PREFIX, FEATURES_QUESTION } from '@/api/models/visitQuestion'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Chip } from '@/components/ui'
import { getErrorMessage } from '@/utils/api'
import { isKnownAnswer, isKnownFeature } from '@/utils/visitQuestions'

import styles from './styles.module.sass'

const SKIPPED_KEY = 'visit_questions_skipped'

/** The visits the block was hidden for, the latest kept: a visit is asked for two days, the list must not grow for years */
const SKIPPED_MAX = 50

/** The answers of a few taps go in one request: sent after this pause, or at once when the block ends */
const FLUSH_DELAY = 4000

/** The page has two of these blocks on a phone (the card and the sheet): a "Пропустить" in one hides the other */
const SKIPPED_EVENT = 'visit-questions-skipped'

const readSkipped = (): string[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]')

        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
    } catch {
        return []
    }
}

const writeSkipped = (ids: string[]) => {
    try {
        localStorage.setItem(SKIPPED_KEY, JSON.stringify(ids.slice(-SKIPPED_MAX)))
    } catch {
        // No storage (a private window): the block comes back on the next visit of the page
    }

    window.dispatchEvent(new Event(SKIPPED_EVENT))
}

interface PlaceVisitQuestionsProps {
    placeId?: string
    /**
     * `card` (default): under the button of the "Где это" card, with a thanks line at the end.
     * `sheet`: in the bottom sheet the phone bar opens after a check-in; it says once when it
     * is over (`onFinish`): `nothing` when there was nothing to ask (the bar then says the
     * result of the check-in another way), `ended` after "Пропустить", "Готово" or the thanks,
     * which go to a toast
     */
    variant?: 'card' | 'sheet'
    /** In the sheet: there is a question to show (the phone bar opens the sheet only then) */
    onAsk?: () => void
    onFinish?: (reason: 'nothing' | 'ended') => void
}

type Phase = 'wait' | 'none' | 'thanks' | 'features' | 'question'

/**
 * Right after a check-in: three one-tap questions about the place (road, entry, state…),
 * one at a time, as chips under the "Я здесь был(а)" button; on phones in a bottom sheet
 * (`variant="sheet"`), since the bar's button is far from the card. Shown to a signed-in
 * visitor whose latest visit (of any day) lacks an answer; "Пропустить" hides it for
 * that visit. The last step, "Что здесь можно?", asks the features of the place: a chip per
 * feature, three states by taps (not answered → yes → no → cleared); "Готово" ends the block.
 * The answers show at once and are saved together, a few taps one `PATCH` (`FLUSH_DELAY`): each
 * save re-renders the place page on the server. The answers feed "Как сейчас" (`PlaceNow`).
 */
export const PlaceVisitQuestions: React.FC<PlaceVisitQuestionsProps> = ({
    placeId,
    variant = 'card',
    onAsk,
    onFinish
}) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data, isFetching } = API.useVisitsGetMeQuery({ place: placeId! }, { skip: !placeId || !isAuth })
    const [patchVisit] = API.useVisitsPatchMutation()

    // Answers given here, until the refetched visit has them: the next question does not flicker
    const [local, setLocal] = useState<Record<string, Record<string, string | null>>>({})
    const [skipped, setSkipped] = useState<string[]>(readSkipped)

    useEffect(() => {
        const sync = () => setSkipped(readSkipped())

        window.addEventListener(SKIPPED_EVENT, sync)

        return () => window.removeEventListener(SKIPPED_EVENT, sync)
    }, [])
    // The visits the features step was ended for ("Готово") or is being filled in: a feature answer
    // that arrives with the refetched visit must not close the step under the visitor's fingers
    const [done, setDone] = useState<string[]>([])
    const [featuresOpen, setFeaturesOpen] = useState<string[]>([])
    // The visit the block was started for: after the last answer it says thanks instead of vanishing
    const [startedId, setStartedId] = useState<string>()

    // Only the questions and values of the client's catalogue have texts: a newer server may send more
    const questions = useMemo(
        () =>
            (data?.questions ?? []).flatMap((question) => {
                if (question.key === FEATURES_QUESTION) {
                    return [question]
                }

                const values = (question.values ?? []).filter((value) => isKnownAnswer(question.key, value))

                return values.length ? [{ ...question, values }] : []
            }),
        [data?.questions]
    )

    // The latest visit, however old: one who checked in before the questions came is asked too
    const visit = useMemo(
        () => [...(data?.items ?? [])].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0],
        [data?.items]
    )

    // The answers not sent yet, of one visit: a tap restarts the pause, the end of the block sends them
    const pendingRef = useRef<{ answers: Record<string, string | null>; visitId: string }>(undefined)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const flush = useCallback(async () => {
        clearTimeout(timerRef.current)

        const pending = pendingRef.current
        pendingRef.current = undefined

        if (!pending || !placeId) {
            return
        }

        try {
            await patchVisit({ answers: pending.answers, id: pending.visitId, place: placeId }).unwrap()
        } catch (error) {
            // Back to what the server has: the answers of the request are dropped from the local ones
            setLocal((prev) => {
                const rest = { ...prev[pending.visitId] }

                Object.keys(pending.answers).forEach((key) => delete rest[key])

                return { ...prev, [pending.visitId]: rest }
            })
            void dispatch(
                Notify({
                    id: 'visitAnswer',
                    message: getErrorMessage(error) ?? t('visit-error', { defaultValue: 'Не удалось сохранить визит' }),
                    title: '',
                    type: 'error'
                })
            )
        }
    }, [dispatch, patchVisit, placeId, t])

    // Leaving the page (a link, a closed sheet) or the tab sends what is left
    const flushRef = useRef(flush)
    flushRef.current = flush

    useEffect(() => {
        const onHidden = () => {
            if (document.visibilityState === 'hidden') {
                void flushRef.current()
            }
        }

        document.addEventListener('visibilitychange', onHidden)

        return () => {
            document.removeEventListener('visibilitychange', onHidden)
            void flushRef.current()
        }
    }, [])

    const handleAnswer = useCallback(
        (visitId: string, key: string, value: string | null) => {
            if (!placeId) {
                return
            }

            if (pendingRef.current && pendingRef.current.visitId !== visitId) {
                void flush()
            }

            setStartedId(visitId)
            setLocal((prev) => ({ ...prev, [visitId]: { ...prev[visitId], [key]: value } }))

            pendingRef.current = { answers: { ...pendingRef.current?.answers, [key]: value }, visitId }
            clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => void flush(), FLUSH_DELAY)
        },
        [flush, placeId]
    )

    const handleFeature = (visitId: string, feature: string, current?: string | null) => {
        // Not answered → yes → no → cleared
        const next = !current ? 'yes' : current === 'yes' ? 'no' : null

        setFeaturesOpen((prev) => (prev.includes(visitId) ? prev : [...prev, visitId]))
        handleAnswer(visitId, `${FEATURE_PREFIX}${feature}`, next)
    }

    // The sheet is told once: the handlers end it themselves, the effect ends it when there is nothing
    const finishedRef = useRef(false)

    const finish = useCallback(
        (reason: 'nothing' | 'ended') => {
            if (variant === 'sheet' && !finishedRef.current) {
                finishedRef.current = true
                onFinish?.(reason)
            }
        },
        [onFinish, variant]
    )

    const thanksText = t('visit-questions-thanks', { defaultValue: 'Спасибо! Это увидят те, кто поедет после вас' })

    // The sheet is gone at the end: the thanks go to a toast
    const thanksToast = useCallback(() => {
        void dispatch(Notify({ id: 'visitThanks', message: thanksText, title: '', type: 'success' }))
    }, [dispatch, thanksText])

    const handleDone = (visitId: string) => {
        void flush()
        setDone((prev) => [...prev, visitId])
        writeSkipped([...readSkipped(), visitId])

        if (variant === 'sheet') {
            thanksToast()
            finish('ended')
        }
    }

    const handleSkip = (visitId: string) => {
        void flush()
        writeSkipped([...readSkipped(), visitId])
        finish('ended')
    }

    const answers = visit ? { ...visit.answers, ...local[visit.id] } : {}
    const next = questions.find((question) => question.values && !answers[question.key])
    const features = questions.find((question) => question.key === FEATURES_QUESTION)
    const featureKeys = (features?.features ?? []).filter(isKnownFeature)
    // Reached after the last ordinary answer; once the visit has a feature answer (a reload), it is done
    const featuresStep =
        !!visit &&
        !next &&
        featureKeys.length > 0 &&
        (featuresOpen.includes(visit.id) ||
            !Object.keys(visit.answers ?? {}).some((key) => key.startsWith(FEATURE_PREFIX)))

    // The sheet opens as the check-in is answered, while the visits are being asked again: wait for them
    const phase: Phase =
        !placeId || !isAuth
            ? 'none'
            : !visit || !questions.length
              ? isFetching && variant === 'sheet'
                  ? 'wait'
                  : 'none'
              : done.includes(visit.id)
                ? 'thanks'
                : skipped.includes(visit.id)
                  ? 'none'
                  : featuresStep
                    ? 'features'
                    : next
                      ? 'question'
                      : startedId === visit.id
                        ? 'thanks'
                        : 'none'

    // In the sheet the end closes it: the last answer (the thanks) or nothing to ask
    useEffect(() => {
        // The last answer given: nothing more to wait for
        if (phase === 'thanks') {
            void flush()
        }

        if (variant !== 'sheet' || finishedRef.current) {
            return
        }

        if (phase === 'thanks') {
            thanksToast()
            finish('ended')
        } else if (phase === 'none') {
            finish('nothing')
        }
    }, [finish, flush, phase, thanksToast, variant])

    useEffect(() => {
        if (variant === 'sheet' && (phase === 'question' || phase === 'features')) {
            onAsk?.()
        }
    }, [onAsk, phase, variant])

    if (!visit || phase === 'none' || phase === 'wait') {
        return null
    }

    const thanks = <p className={styles.secondary}>{thanksText}</p>

    if (phase === 'thanks') {
        return variant === 'sheet' ? null : thanks
    }

    if (phase === 'features') {
        return (
            <div className={styles.questions}>
                <p className={styles.secondary}>
                    {t('visit-questions-intro', {
                        defaultValue: 'Вы были здесь. Пара слов для тех, кто поедет после вас:'
                    })}
                </p>
                <p className={styles.question}>{t(`visitQuestions.${FEATURES_QUESTION}.question`)}</p>
                <div className={styles.chips}>
                    {featureKeys.map((feature) => {
                        const value = answers[`${FEATURE_PREFIX}${feature}`]

                        return (
                            <Chip
                                key={feature}
                                size={'small'}
                                label={t(`visitFeatures.${feature}`)}
                                selected={value === 'yes'}
                                negative={value === 'no'}
                                aria-label={
                                    value === 'yes'
                                        ? t('visit-feature-can', { feature: t(`visitFeatures.${feature}`) })
                                        : value === 'no'
                                          ? t('visit-feature-cannot', { feature: t(`visitFeatures.${feature}`) })
                                          : undefined
                                }
                                onClick={() => handleFeature(visit.id, feature, value)}
                            />
                        )
                    })}
                </div>
                <Button
                    mode={'link'}
                    size={'small'}
                    className={styles.skip}
                    label={t('visit-questions-done', { defaultValue: 'Готово' })}
                    onClick={() => handleDone(visit.id)}
                />
            </div>
        )
    }

    if (!next) {
        return null
    }

    return (
        <div className={styles.questions}>
            <p className={styles.secondary}>
                {t('visit-questions-intro', {
                    defaultValue: 'Вы были здесь. Пара слов для тех, кто поедет после вас:'
                })}
            </p>
            <p className={styles.question}>{t(`visitQuestions.${next.key}.question`)}</p>
            <div className={styles.chips}>
                {(next.values ?? []).map((value) => (
                    <Chip
                        key={value}
                        size={'small'}
                        label={t(`visitQuestions.${next.key}.values.${value}`)}
                        onClick={() => handleAnswer(visit.id, next.key, value)}
                    />
                ))}
            </div>
            <Button
                mode={'link'}
                size={'small'}
                className={styles.skip}
                label={t('visit-questions-skip', { defaultValue: 'Пропустить' })}
                onClick={() => handleSkip(visit.id)}
            />
        </div>
    )
}
