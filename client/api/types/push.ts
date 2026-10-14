/** The browser's PushSubscription as JSON (PushSubscription.toJSON()) */
export interface Subscription {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}

export interface KeyResponse {
    /** VAPID public key; null when push is not set up on the server */
    publicKey: string | null
}

export interface StatusResponse {
    /** This device's subscription is on for the signed-in user */
    active: boolean
    /** Devices of the user with push on */
    devices: number
}

export interface SubscribeRequest extends Subscription {
    /** IANA time zone of the device, for the quiet hours */
    timezone?: string
}

export interface TestResponse {
    sent: number
    devices: number
}
