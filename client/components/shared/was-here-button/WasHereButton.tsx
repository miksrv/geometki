import React, { useCallback, useEffect, useRef } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify, NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { getErrorMessage } from '@/utils/api'
import { localPlainDate } from '@/utils/date'

import styles from './styles.module.sass'

const PENDING_VISITS_KEY = 'pending_visits'
const VISIT_TTL_MS = 86400000 // 24 hours

/** A failure that may pass later: no answer at all, or a 5xx */
const isTransientError = (error: unknown): boolean => {
    const status = (error as { status?: unknown } | undefined)?.status

    return typeof status !== 'number' || status >= 500
}
/** A guest who signed in within this time after the tap is checked in without a second tap */
const SIGN_IN_WAIT_MS = 10 * 60 * 1000

/**
 * A guest's tap waiting for the sign-in. In the session storage: the sign-in may reload the page
 * (the cached page switching to its live copy, a return from an OAuth provider). Kept in memory
 * too, for a browser without storage.
 */
const SIGN_IN_INTENT_KEY = 'visit_sign_in_intent'

interface SignInIntent {
    placeId: string
    timestamp: number
}

let memoryIntent: SignInIntent | undefined

const readIntent = (): SignInIntent | undefined => {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(SIGN_IN_INTENT_KEY) ?? 'null')

        return parsed?.placeId && typeof parsed.timestamp === 'number' ? parsed : undefined
    } catch {
        return memoryIntent
    }
}

const writeIntent = (intent?: SignInIntent) => {
    memoryIntent = intent

    try {
        if (intent) {
            sessionStorage.setItem(SIGN_IN_INTENT_KEY, JSON.stringify(intent))
        } else {
            sessionStorage.removeItem(SIGN_IN_INTENT_KEY)
        }
    } catch {
        // No storage: the intent lives in memory, until a reload
    }
}

interface PendingVisit {
    placeId: string
    /** Whose visit it is: a shared browser must not post it as another user */
    userId: string
    /** The day of the visit, `YYYY-MM-DD` */
    visitedAt: string
    timestamp: number
}

const readPending = (): PendingVisit[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(PENDING_VISITS_KEY) ?? '[]')

        // Entries of the older formats (a toggle with coordinates, no user) have no day or owner: dropped
        return Array.isArray(parsed) ? parsed.filter((item) => item?.placeId && item?.visitedAt && item?.userId) : []
    } catch {
        return []
    }
}

const writePending = (items: PendingVisit[]) => {
    try {
        localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(items))
    } catch {
        // No storage (a private window): the visit is lost with the connection, nothing to do
    }
}

/** Places with a check-in on its way: the buttons of one place share it, so a double tap sends one request */
const inFlight = new Set<string>()

interface WasHereButtonProps {
    placeId?: string
    size?: 'small' | 'medium' | 'large'
    /** Icon only, the label goes to the tooltip (the phone actions bar) */
    hideLabel?: boolean
    stretched?: boolean
    className?: string
    /**
     * Takes the answered check-in (a new visit or the day's one) instead of the toast: the phone
     * bar opens the questions with the result as the title (`checkInMessage()`)
     */
    onCheckedIn?: (visit: ApiType.Visits.CreateResponse) => void
}

/**
 * What a check-in says: "Визит №3 в это место" (or "already today") and, for the first visit
 * of the year, a second line. The toast joins them, the phone sheet shows them as its title
 * and a line under it.
 */
export const checkInMessage = (
    visit: Pick<ApiType.Visits.CreateResponse, 'isNew' | 'ordinal' | 'firstThisYear'>,
    t: (key: string, options?: Record<string, unknown>) => string
): { title: string; note?: string } => ({
    note:
        visit.isNew && visit.firstThisYear
            ? t('visit-result-first-this-year', { defaultValue: 'Вы первый, кто побывал здесь в этом году' })
            : undefined,
    title: visit.isNew
        ? t('visit-result-title', { defaultValue: 'Визит №{{count}} в это место', count: visit.ordinal })
        : t('visit-already-today', { defaultValue: 'Вы уже отмечались здесь сегодня' })
})

/**
 * "Я здесь был(а)": one tap checks in, with no location and no form, and a toast tells the number
 * of the visit. A visit is a log entry: with visits the button turns green (success tint, the same
 * in every place it is shown), reads "Вы были здесь · 3 раза" and a tap checks in again (one visit
 * per day, a second tap the same day says so). A guest signs in first and is checked in right after,
 * even when the sign-in reloads the page; closing the sign-in dialog drops the tap.
 */
export const WasHereButton: React.FC<WasHereButtonProps> = ({
    placeId,
    size = 'small',
    hideLabel,
    stretched,
    className,
    onCheckedIn
}) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const userId = useAppSelector((state) => state.auth.user?.id)
    const showAuthDialog = useAppSelector((state) => state.application.showAuthDialog)

    // The place page has this button twice (phone actions bar, "Где это"): one cache key shares
    // the loading state between them
    const [postVisit, { isLoading }] = API.useVisitsPostMutation({ fixedCacheKey: `visit-${placeId}` })
    // The queue of the visits saved offline posts for any place: it keeps out of the buttons' state
    const [postQueued] = API.useVisitsPostMutation()

    const { data: myVisits } = API.useVisitsGetMeQuery({ place: placeId! }, { skip: !placeId || !isAuth })

    const count = myVisits?.count ?? 0

    const notifyError = useCallback(
        (error: unknown) =>
            void dispatch(
                Notify({
                    id: 'visited',
                    message: getErrorMessage(error) ?? t('visit-error', { defaultValue: 'Не удалось сохранить визит' }),
                    title: '',
                    type: 'error'
                })
            ),
        [dispatch, t]
    )

    const savePendingVisit = useCallback(
        (visitedAt: string) => {
            if (!placeId || !userId) {
                return
            }

            writePending([...readPending(), { placeId, timestamp: Date.now(), userId, visitedAt }])
        },
        [placeId, userId]
    )

    const checkIn = useCallback(async () => {
        if (!placeId) {
            return
        }

        const visitedAt = localPlainDate(0)

        if (!navigator.onLine) {
            savePendingVisit(visitedAt)
            void dispatch(
                NotifyReplace({
                    id: 'visited',
                    message: t('visit-saved-offline', {
                        defaultValue: 'Визит сохранён и будет отправлен, когда появится связь'
                    }),
                    type: 'success'
                })
            )
            return
        }

        // The other button of this place has a request on its way
        if (inFlight.has(placeId)) {
            return
        }

        inFlight.add(placeId)

        try {
            // The same day answers that day's visit (`isNew: false`)
            const visit = await postVisit({ place: placeId, visitedAt }).unwrap()

            if (onCheckedIn) {
                onCheckedIn(visit)
            } else {
                const { title, note } = checkInMessage(visit, t)

                void dispatch(
                    NotifyReplace({ id: 'visited', message: [title, note].filter(Boolean).join('. '), type: 'success' })
                )
            }
        } catch (error) {
            notifyError(error)
        } finally {
            inFlight.delete(placeId)
        }
    }, [dispatch, notifyError, onCheckedIn, placeId, postVisit, savePendingVisit, t])

    // The visits saved offline: a day's visit is one, a resend cannot duplicate it
    const flushPendingVisits = useCallback(async () => {
        if (!userId) {
            return
        }

        const now = Date.now()
        // The visits of other users of this browser are dropped: they are never posted as this one
        const queue = readPending()
        const pending = queue.filter((item) => item.userId === userId)

        if (!queue.length) {
            return
        }

        // The page has several of these buttons, each one listens for `online`: the first to run
        // takes the queue synchronously, the others find it empty
        writePending([])

        const remaining: PendingVisit[] = []

        for (const visit of pending.filter((item) => now - item.timestamp < VISIT_TTL_MS)) {
            try {
                await postQueued({ place: visit.placeId, visitedAt: visit.visitedAt }).unwrap()
            } catch (error) {
                // Still offline or the API is down: kept for the next time. A refusal (the place is
                // gone, the day is out of the window) would be the same tomorrow: dropped
                if (isTransientError(error)) {
                    remaining.push(visit)
                }
            }
        }

        // Visits saved offline while these were being sent stay in the queue too
        writePending([...readPending(), ...remaining])
    }, [postQueued, userId])

    useEffect(() => {
        const handleOnline = () => {
            void flushPendingVisits()
        }

        // Back online before the page was opened (or signed in just now): nothing fires `online`
        if (isAuth && navigator.onLine) {
            handleOnline()
        }

        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('online', handleOnline)
        }
    }, [flushPendingVisits, isAuth])

    // The guest signed in after the tap (on this page or after a reload): the visit is made now.
    // The place has two buttons: the first to run takes the intent, the other finds none
    useEffect(() => {
        if (!isAuth || !placeId) {
            return
        }

        const intent = readIntent()

        if (intent?.placeId !== placeId) {
            return
        }

        writeIntent(undefined)

        if (Date.now() - intent.timestamp < SIGN_IN_WAIT_MS) {
            void checkIn()
        }
    }, [isAuth, placeId, checkIn])

    // The sign-in dialog closed without a sign-in: the tap is dropped (a successful sign-in sets
    // the user before it closes the dialog, the effect above has taken the intent by then)
    const dialogWasOpen = useRef(false)

    useEffect(() => {
        if (showAuthDialog) {
            dialogWasOpen.current = true
            return
        }

        if (dialogWasOpen.current) {
            dialogWasOpen.current = false

            if (!isAuth && readIntent()?.placeId === placeId) {
                writeIntent(undefined)
            }
        }
    }, [isAuth, placeId, showAuthDialog])

    const handleClick = () => {
        if (!isAuth) {
            if (placeId) {
                writeIntent({ placeId, timestamp: Date.now() })
            }

            dispatch(openAuthDialog())
            return
        }

        void checkIn()
    }

    const label =
        count > 0
            ? t('visit-button-times', { count, defaultValue: 'Вы были здесь · {{count}}' })
            : t('visited-was-here')

    return (
        <>
            <Button
                mode={'secondary'}
                size={size}
                icon={'CheckCircle'}
                stretched={stretched}
                className={cn(styles.wasHereButton, count > 0 && styles.visited, className)}
                disabled={!placeId || isLoading}
                loading={isLoading}
                label={hideLabel ? undefined : label}
                tooltip={hideLabel ? label : undefined}
                onClick={handleClick}
            />
        </>
    )
}
