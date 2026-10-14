import { useCallback, useEffect, useState } from 'react'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import * as Push from '@/utils/push'

/**
 * The state of push notifications on this device for the signed-in user:
 *  - `loading` — not known yet (client only: SSR has no browser APIs);
 *  - `unsupported` — the browser has no web push;
 *  - `ios-install` — iOS / iPadOS Safari: works only from the Home Screen;
 *  - `unavailable` — no service worker (not a production build) or push not set up on the server;
 *  - `denied` — blocked in the browser settings; only the user can unblock it there;
 *  - `off` — can be turned on (the browser may still ask for the permission);
 *  - `on` — this device gets pushes for this account.
 */
export type PushState = 'loading' | 'unsupported' | 'ios-install' | 'unavailable' | 'denied' | 'off' | 'on'

/** What turning push on came to: `denied` — refused in the browser prompt; `error` — anything else */
export type PushEnableResult = 'ok' | 'denied' | 'error'

const usePushSubscription = () => {
    const isAuth = useAppSelector((state) => state.auth.isAuth === true)

    const [support, setSupport] = useState<Push.PushSupport | undefined>()
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
    const [endpoint, setEndpoint] = useState<string | null | undefined>()
    const [hasWorker, setHasWorker] = useState<boolean | undefined>()
    const [busy, setBusy] = useState(false)
    // The endpoint this hook has just bound: shown as on while its status is loading
    const [enabledEndpoint, setEnabledEndpoint] = useState<string | null>(null)

    const supported = support === 'supported'

    const { data: key, isLoading: keyLoading } = API.usePushGetKeyQuery(undefined, { skip: !isAuth || !supported })
    const {
        data: status,
        isError: statusError,
        isLoading: statusLoading
    } = API.usePushGetStatusQuery(endpoint ?? '', { skip: !isAuth || !endpoint })

    const [postSubscription] = API.usePushPostSubscriptionMutation()
    const [deleteSubscription] = API.usePushDeleteSubscriptionMutation()
    const [postTest] = API.usePushPostTestMutation()

    const readDevice = useCallback(async () => {
        const deviceSupport = Push.getPushSupport()

        setSupport(deviceSupport)
        setPermission(Push.getPermission())

        if (deviceSupport !== 'supported') {
            setEndpoint(null)
            setHasWorker(false)
            return
        }

        const registration = await Push.getRegistration()

        setHasWorker(!!registration)
        setEndpoint((await registration?.pushManager.getSubscription())?.endpoint ?? null)
    }, [])

    // Read the device on mount and again when the user comes back to the tab: the worker
    // may have registered meanwhile, the permission may have been changed in the browser
    useEffect(() => {
        void readDevice()

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void readDevice()
            }
        }

        document.addEventListener('visibilitychange', onVisible)

        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [readDevice])

    const state: PushState = (() => {
        if (support === undefined || endpoint === undefined || hasWorker === undefined) {
            return 'loading'
        }

        if (support !== 'supported') {
            return support
        }

        if (!hasWorker) {
            return 'unavailable'
        }

        if (keyLoading) {
            return 'loading'
        }

        // Push not set up on the server, or its key could not be read
        if (!key?.publicKey) {
            return 'unavailable'
        }

        if (permission === 'denied') {
            return 'denied'
        }

        // Only the first load: a refetch after enable / disable keeps the last state on screen
        if (endpoint && statusLoading) {
            return endpoint === enabledEndpoint ? 'on' : 'loading'
        }

        // The status could not be read: offer to turn push on, which re-binds this device
        return endpoint && !statusError && status?.active ? 'on' : 'off'
    })()

    /** Must be called from a click: the browser shows its permission prompt only then */
    const enable = useCallback(async (): Promise<PushEnableResult> => {
        if (!key?.publicKey) {
            return 'error'
        }

        setBusy(true)

        try {
            const subscription = await Push.subscribe(key.publicKey)

            await postSubscription(Push.toSubscribeRequest(subscription)).unwrap()
            setEnabledEndpoint(subscription.endpoint)
            setEndpoint(subscription.endpoint)

            return 'ok'
        } catch (error) {
            return error instanceof Error && error.message === 'denied' ? 'denied' : 'error'
        } finally {
            setPermission(Push.getPermission())
            setBusy(false)
        }
    }, [key, postSubscription])

    const disable = useCallback(async (): Promise<void> => {
        setBusy(true)

        try {
            const removed = await Push.unsubscribe()

            if (removed) {
                await deleteSubscription(removed).unwrap()
            }
        } catch {
            // The browser side is gone anyway; the server drops a dead device by itself
        } finally {
            setEnabledEndpoint(null)
            setEndpoint(null)
            setBusy(false)
        }
    }, [deleteSubscription])

    const sendTest = useCallback(async (): Promise<boolean> => {
        try {
            return (await postTest().unwrap()).sent > 0
        } catch {
            return false
        }
    }, [postTest])

    return { busy, devices: status?.devices ?? 0, disable, enable, endpoint, sendTest, state, status }
}

export default usePushSubscription
