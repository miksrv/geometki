/**
 * Web push in the browser: support, permission, the push subscription of this device.
 * The subscription lives in the service worker registration (public/sw.js), which is
 * registered in production builds only (utils/serviceWorker.ts): elsewhere push is
 * unavailable.
 *
 * iOS and iPadOS support web push only in a site added to the Home Screen (16.4+);
 * in Safari itself the API is missing, and the user has to install the site first.
 */

export type PushSupport = 'supported' | 'unsupported' | 'ios-install'

export const isIos = (): boolean =>
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        // iPadOS reports itself as a Mac with touch
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const isStandalone = (): boolean =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const getPushSupport = (): PushSupport => {
    if (typeof window === 'undefined') {
        return 'unsupported'
    }

    const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

    if (hasApi) {
        return 'supported'
    }

    return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
}

export const getPermission = (): NotificationPermission | 'unsupported' =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'

/** The service worker registration, or null when there is none (not production, not registered yet) */
export const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return null
    }

    return (await navigator.serviceWorker.getRegistration('/')) ?? null
}

/** How long subscribing waits for a just-registered worker to become active */
const WORKER_READY_TIMEOUT = 5000

/**
 * The active registration to subscribe with: on a first visit the worker may still be
 * installing, and PushManager.subscribe() needs an active one. `ready` never settles
 * without a worker, hence the timeout.
 */
const getActiveRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!(await getRegistration())) {
        return null
    }

    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_READY_TIMEOUT))
    ])
}

export const getSubscription = async (): Promise<PushSubscription | null> => {
    const registration = await getRegistration()

    return registration ? registration.pushManager.getSubscription() : null
}

/** The VAPID key from base64url to the bytes PushManager.subscribe() takes */
export const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(new ArrayBuffer(raw.length))

    for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i)
    }

    return bytes
}

/** Whether a subscription's applicationServerKey is the given one; an unknown key counts as the same */
const isSameKey = (current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean => {
    if (!current) {
        return true
    }

    const bytes = new Uint8Array(current)

    return bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i])
}

/**
 * Ask for the permission (when not given yet) and subscribe this device.
 * Must run from a user gesture: browsers block the permission prompt otherwise.
 *
 * @throws Error 'denied' when the user refused, 'no-worker' without a service worker
 */
export const subscribe = async (publicKey: string): Promise<PushSubscription> => {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()

    if (permission !== 'granted') {
        throw new Error('denied')
    }

    const registration = await getActiveRegistration()

    if (!registration) {
        throw new Error('no-worker')
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey)
    const existing = await registration.pushManager.getSubscription()

    if (existing) {
        if (isSameKey(existing.options?.applicationServerKey, applicationServerKey)) {
            return existing
        }

        // Made with another VAPID key (the server's keys were replaced): the push service
        // would reject every push to it
        await existing.unsubscribe()
    }

    return registration.pushManager.subscribe({ applicationServerKey, userVisibleOnly: true })
}

/** Drop this device's subscription; returns its endpoint (to remove it on the server too) */
export const unsubscribe = async (): Promise<string | null> => {
    const subscription = await getSubscription()

    if (!subscription) {
        return null
    }

    const endpoint = subscription.endpoint

    await subscription.unsubscribe()

    return endpoint
}

export const toSubscribeRequest = (subscription: PushSubscription) => {
    const json = subscription.toJSON()

    return {
        endpoint: subscription.endpoint,
        keys: { auth: json.keys?.auth ?? '', p256dh: json.keys?.p256dh ?? '' },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
}
