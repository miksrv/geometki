/**
 * Registers the service worker (public/sw.js) in production builds. The app version goes into
 * the script URL: a new release is a new script, so the browser installs it and the worker
 * drops the caches of the previous one. Registration waits for the page load, so it never
 * competes with the page's own requests.
 *
 * Outside production the worker is removed instead: one left on the origin by a production
 * build (`yarn build && yarn start` on the same port) would serve the dev server's chunks from
 * its cache-first cache, and dev chunk names do not change with the code, so the page would run
 * stale scripts (hydration errors).
 */
export const registerServiceWorker = (version: string): void => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return
    }

    if (process.env.NODE_ENV !== 'production') {
        void unregisterServiceWorkers()
        return
    }

    const register = () => {
        navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: '/' }).catch(() => {
            // Without the worker the site works as a regular one
        })
    }

    if (document.readyState === 'complete') {
        register()
    } else {
        window.addEventListener('load', register, { once: true })
    }
}

const unregisterServiceWorkers = async (): Promise<void> => {
    try {
        const registrations = await navigator.serviceWorker.getRegistrations()

        await Promise.all(registrations.map((registration) => registration.unregister()))

        if ('caches' in window) {
            const keys = await caches.keys()

            // Only the worker's own caches (see public/sw.js)
            await Promise.all(keys.filter((key) => key.startsWith('geometki-')).map((key) => caches.delete(key)))
        }
    } catch {
        // Nothing to clean up
    }
}
