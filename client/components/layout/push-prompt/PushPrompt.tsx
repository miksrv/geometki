import React, { useEffect, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { dismissPushPrompt } from '@/app/applicationSlice'
import { NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { LOCAL_STORAGE } from '@/config/constants'
import usePushSubscription from '@/hooks/usePushSubscription'
import * as LocalStorage from '@/utils/localstorage'
import * as Push from '@/utils/push'

import styles from './styles.module.sass'

/** "Not now" brings the offer back after this many days */
export const PUSH_PROMPT_SNOOZE_DAYS = 14

const NEVER = 'never'

/** Whether the user put the offer off ("Not now" still running) or declined it for good */
export const isPushPromptDismissed = (stored: string, now: number = Date.now()): boolean =>
    stored === NEVER || (!!stored && Number(stored) > now)

/**
 * The offer to turn push on, after the user did something others react to (a place, a photo,
 * a rating, a comment — applicationSlice). Never on page load, never the browser prompt first:
 * the browser asks only after "Turn on". Shown only when push can be turned on here.
 *
 * Also keeps this device's push with its owner (PushOwnerCheck).
 */
export const PushPrompt: React.FC = () => {
    const requested = useAppSelector((state) => state.application.pushPromptRequested === true)
    const isAuth = useAppSelector((state) => state.auth.isAuth === true)

    if (!isAuth) {
        return null
    }

    return (
        <>
            <PushOwnerCheck />
            {/* The push state (and its requests) only once there is something to offer */}
            {requested && <PushPromptCard />}
        </>
    )
}

/**
 * A browser subscription that belongs to another account (someone else signed in on this
 * browser without signing the previous user out from the menu) is dropped: the previous
 * user's notifications must not keep coming to this device.
 */
const PushOwnerCheck: React.FC = () => {
    const [endpoint, setEndpoint] = useState<string | null>(null)

    const { data: status, startedTimeStamp } = API.usePushGetStatusQuery(endpoint ?? '', { skip: !endpoint })
    const [deleteSubscription] = API.usePushDeleteSubscriptionMutation()

    useEffect(() => {
        void Push.getSubscription()
            .then((subscription) => setEndpoint(subscription?.endpoint ?? null))
            .catch(() => setEndpoint(null))
    }, [])

    useEffect(() => {
        // The user is turning push on (e.g. on /users/settings right after the page loaded):
        // the same subscription is being bound to them, the status refetches after that
        if (endpoint && status && !status.active && !Push.isStatusStale(startedTimeStamp)) {
            void Push.unsubscribe()
                .then(() => deleteSubscription(endpoint))
                .catch(() => undefined)
                .finally(() => setEndpoint(null))
        }
    }, [endpoint, status, startedTimeStamp])

    return null
}

const PushPromptCard: React.FC = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const router = useRouter()

    const { busy, enable, state } = usePushSubscription()
    const [dismissed, setDismissed] = useState(true)

    useEffect(() => {
        setDismissed(isPushPromptDismissed(LocalStorage.getItem(LOCAL_STORAGE.PUSH_PROMPT as 'PUSH_PROMPT')))
    }, [])

    // The settings page has its own switch
    const onSettings = router.pathname === '/users/settings'
    const visible = !dismissed && state === 'off' && !onSettings

    // Nothing to offer after this action (push already on, blocked, put off...): the request
    // ends here, so it cannot pop up later, out of context
    useEffect(() => {
        if (state !== 'loading' && !visible) {
            dispatch(dismissPushPrompt())
        }
    }, [state, visible])

    const close = (stored?: string) => {
        if (stored) {
            LocalStorage.setItem(LOCAL_STORAGE.PUSH_PROMPT as 'PUSH_PROMPT', stored)
        }

        setDismissed(true)
        dispatch(dismissPushPrompt())
    }

    const snooze = () => close(String(Date.now() + PUSH_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000))

    useEffect(() => {
        if (!visible) {
            return
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                snooze()
            }
        }

        window.addEventListener('keydown', onKey)

        return () => window.removeEventListener('keydown', onKey)
    }, [visible])

    if (!visible) {
        return null
    }

    const handleEnable = async () => {
        const result = await enable()

        // Refused in the browser prompt: the browser will not ask again anyway
        if (result === 'denied') {
            close(NEVER)
            return
        }

        void dispatch(
            NotifyReplace({
                id: 'pushEnable',
                message: t(result === 'ok' ? 'push-enabled' : 'push-enable-failed'),
                title: '',
                type: result === 'ok' ? 'success' : 'error'
            })
        )

        // A failure (offline, the server) leaves the card open to try again
        if (result === 'ok') {
            close()
        }
    }

    return (
        <section
            className={styles.prompt}
            role={'region'}
            aria-labelledby={'push-prompt-title'}
            aria-describedby={'push-prompt-text'}
        >
            <h2
                id={'push-prompt-title'}
                className={styles.title}
            >
                {t('push-prompt-title')}
            </h2>
            <p
                id={'push-prompt-text'}
                className={styles.text}
            >
                {t('push-prompt-text')}
            </p>
            <div className={styles.actions}>
                <Button
                    size={'medium'}
                    mode={'primary'}
                    loading={busy}
                    disabled={busy}
                    label={t('push-prompt-enable')}
                    onClick={() => void handleEnable()}
                />
                <Button
                    size={'medium'}
                    mode={'secondary'}
                    disabled={busy}
                    label={t('push-prompt-later')}
                    onClick={snooze}
                />
                <Button
                    size={'medium'}
                    mode={'link'}
                    disabled={busy}
                    label={t('push-prompt-never')}
                    onClick={() => close(NEVER)}
                />
            </div>
        </section>
    )
}
