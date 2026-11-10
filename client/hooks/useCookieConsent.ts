import { useEffect, useState } from 'react'

import { LOCAL_STORAGE } from '@/config/constants'
import * as LocalStorage from '@/utils/localstorage'

/** Told to every `useCookieConsent` on the page when the visitor closes the cookie notice */
const ACCEPTED_EVENT = 'geometki:cookie-consent'

/**
 * Whether the visitor has closed the cookie notice on this browser: `undefined` until known
 * (the server render and the first client render, so they agree), then true or false. The
 * floating prompts take turns: the push offer waits until the notice is closed.
 */
export const useCookieConsent = (): { accepted: boolean | undefined; accept: () => void } => {
    const [accepted, setAccepted] = useState<boolean | undefined>(undefined)

    useEffect(() => {
        setAccepted(!!LocalStorage.getItem(LOCAL_STORAGE.COOKIE_CONSENT as 'COOKIE_CONSENT'))

        const onAccepted = () => setAccepted(true)

        window.addEventListener(ACCEPTED_EVENT, onAccepted)

        return () => window.removeEventListener(ACCEPTED_EVENT, onAccepted)
    }, [])

    const accept = () => {
        LocalStorage.setItem(LOCAL_STORAGE.COOKIE_CONSENT as 'COOKIE_CONSENT', String(Date.now()))
        window.dispatchEvent(new Event(ACCEPTED_EVENT))
    }

    return { accept, accepted }
}
