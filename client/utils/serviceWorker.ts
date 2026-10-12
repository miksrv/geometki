/**
 * Registers the service worker (public/sw.js) in production builds. The app version goes into
 * the script URL: a new release is a new script, so the browser installs it and the worker
 * drops the caches of the previous one. Registration waits for the page load, so it never
 * competes with the page's own requests.
 */
export const registerServiceWorker = (version: string): void => {
    if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
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
