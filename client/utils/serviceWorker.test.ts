import { registerServiceWorker } from './serviceWorker'

describe('registerServiceWorker', () => {
    const register = jest.fn()
    const env = process.env as Record<string, string | undefined>
    const originalEnv = env.NODE_ENV

    afterEach(() => {
        env.NODE_ENV = originalEnv
        delete (navigator as unknown as Record<string, unknown>).serviceWorker
    })

    beforeEach(() => {
        register.mockReset().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } })
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
        env.NODE_ENV = 'production'
    })

    it('registers the worker with the app version in the script URL', () => {
        registerServiceWorker('1.15.1')
        expect(register).toHaveBeenCalledWith('/sw.js?v=1.15.1', { scope: '/' })
    })

    it('does nothing outside production builds', () => {
        env.NODE_ENV = 'development'
        registerServiceWorker('1.15.1')
        expect(register).not.toHaveBeenCalled()
    })

    it('does nothing when the browser has no service workers', () => {
        delete (navigator as unknown as Record<string, unknown>).serviceWorker
        expect(() => registerServiceWorker('1.15.1')).not.toThrow()
    })

    it('waits for the page load before registering', () => {
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
        registerServiceWorker('1.15.1')
        expect(register).not.toHaveBeenCalled()

        window.dispatchEvent(new Event('load'))
        expect(register).toHaveBeenCalledTimes(1)
    })

    it('swallows a failed registration', async () => {
        register.mockRejectedValue(new Error('blocked'))
        registerServiceWorker('1.15.1')
        await expect(register.mock.results[0].value).rejects.toThrow('blocked')
    })
})
