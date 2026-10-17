import { getPushSupport, isStatusStale, toSubscribeRequest, urlBase64ToUint8Array, whileEnabling } from './push'

describe('push utils', () => {
    const original = { matchMedia: window.matchMedia, userAgent: navigator.userAgent }

    const setUserAgent = (value: string) => Object.defineProperty(navigator, 'userAgent', { configurable: true, value })

    afterEach(() => {
        setUserAgent(original.userAgent)
        delete (window as unknown as Record<string, unknown>).PushManager
        delete (navigator as unknown as Record<string, unknown>).serviceWorker
        delete (window as unknown as Record<string, unknown>).Notification
        window.matchMedia = original.matchMedia
    })

    it('is supported with a service worker, PushManager and Notification', () => {
        Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
        Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
        Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default' } })

        expect(getPushSupport()).toBe('supported')
    })

    it('asks iOS Safari users to add the site to the Home Screen', () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
        window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia

        expect(getPushSupport()).toBe('ios-install')
    })

    it('is unsupported elsewhere', () => {
        setUserAgent('Mozilla/5.0 (Windows NT 10.0)')
        window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia

        expect(getPushSupport()).toBe('unsupported')
    })

    it('decodes a base64url VAPID key', () => {
        expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toStrictEqual([1, 2, 3, 255, 239])
    })

    it('sends the endpoint, the keys and the time zone', () => {
        const subscription = {
            endpoint: 'https://push.example/abc',
            toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { auth: 'A', p256dh: 'P' } })
        } as unknown as PushSubscription

        const request = toSubscribeRequest(subscription)

        expect(request.endpoint).toBe('https://push.example/abc')
        expect(request.keys).toStrictEqual({ auth: 'A', p256dh: 'P' })
        expect(typeof request.timezone).toBe('string')
    })

    it('distrusts a push status asked for before turning push on ended', async () => {
        const before = Date.now() - 1000

        let during = false
        await whileEnabling(async () => {
            during = isStatusStale(Date.now() + 1000)
        })

        expect(during).toBe(true)
        expect(isStatusStale(before)).toBe(true)
        expect(isStatusStale(Date.now() + 1000)).toBe(false)

        await expect(
            whileEnabling(async () => {
                throw new Error('denied')
            })
        ).rejects.toThrow('denied')
        expect(isStatusStale(Date.now() + 1000)).toBe(false)
    })
})
