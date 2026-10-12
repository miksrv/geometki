/*
 * Geometki service worker.
 *
 * Deliberately small and conservative, because pages are rendered on the server with per-user
 * data (auth, notifications, private collections):
 *   - pages (navigations) always go to the network; the cached offline page is only a fallback
 *     when there is no connection, a stale HTML page is never shown;
 *   - hashed build assets (/_next/static) are immutable: cache first;
 *   - icons and images from /public: cache, refreshed in the background;
 *   - everything else (API, /_next/data, /_next/image, map tiles, analytics) is not touched.
 *
 * The script is registered as /sw.js?v=<app version> (pages/_app.tsx), so every release installs
 * a new worker with its own caches and the old ones are dropped on activation.
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const PRECACHE = `geometki-precache-${VERSION}`
const STATIC_CACHE = `geometki-static-${VERSION}`
const ASSETS_CACHE = `geometki-assets-${VERSION}`
const CURRENT_CACHES = [PRECACHE, STATIC_CACHE, ASSETS_CACHE]

const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [OFFLINE_URL, '/android-chrome-192x192.png']

// Public files worth keeping for repeat launches; the rest of /public is left to the HTTP cache
const ASSET_PATTERN = /^\/(images\/.+|favicon.*|android-chrome-.+|maskable-icon-.+|apple-touch-icon\.png)$/

// A long session over many releases should not grow the caches without bound
const MAX_ASSET_ENTRIES = 300

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(PRECACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key.startsWith('geometki-') && !CURRENT_CACHES.includes(key))
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event

    if (request.method !== 'GET') {
        return
    }

    const url = new URL(request.url)

    if (url.origin !== self.location.origin) {
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(event))
        return
    }

    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, STATIC_CACHE))
        return
    }

    if (ASSET_PATTERN.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(event, ASSETS_CACHE))
    }
})

async function handleNavigation(event) {
    try {
        const preloaded = await event.preloadResponse

        if (preloaded) {
            return preloaded
        }

        return await fetch(event.request)
    } catch {
        const offline = await caches.match(OFFLINE_URL)

        return offline || Response.error()
    }
}

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request)

    if (cached) {
        return cached
    }

    const response = await fetch(request)

    if (response.ok) {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
        await trimCache(cache)
    }

    return response
}

async function staleWhileRevalidate(event, cacheName) {
    const cache = await caches.open(cacheName)
    // All caches, not only this one: the offline page's icon lives in the precache
    const cached = await caches.match(event.request)

    const network = fetch(event.request)
        .then(async (response) => {
            if (response.ok) {
                await cache.put(event.request, response.clone())
                await trimCache(cache)
            }

            return response
        })
        .catch(() => cached || Response.error())

    if (cached) {
        event.waitUntil(network)
        return cached
    }

    return network
}

async function trimCache(cache) {
    const keys = await cache.keys()

    // Oldest entries first (the order they were added in)
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES)).map((key) => cache.delete(key)))
}
