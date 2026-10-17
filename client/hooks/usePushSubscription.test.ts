import { act, renderHook, waitFor } from '@testing-library/react'

import { API } from '@/api'
import * as Push from '@/utils/push'

import usePushSubscription from './usePushSubscription'

jest.mock('@/app/store', () => ({
    useAppSelector: (selector: (state: { auth: { isAuth: boolean } }) => unknown) =>
        selector({ auth: { isAuth: true } })
}))

jest.mock('@/api', () => ({
    API: {
        usePushDeleteSubscriptionMutation: jest.fn(),
        usePushGetKeyQuery: jest.fn(),
        usePushGetStatusQuery: jest.fn(),
        usePushPostSubscriptionMutation: jest.fn(),
        usePushPostTestMutation: jest.fn()
    }
}))

jest.mock('@/utils/push', () => ({
    getPermission: jest.fn(),
    getPushSupport: jest.fn(),
    getRegistration: jest.fn(),
    subscribe: jest.fn(),
    toSubscribeRequest: jest.fn((subscription: { endpoint: string }) => ({ endpoint: subscription.endpoint })),
    unsubscribe: jest.fn(),
    whileEnabling: (run: () => Promise<unknown>) => run()
}))

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => jest.mocked(fn)
const mockPost = jest.fn()

const device = (endpoint: string | null) =>
    mocked(Push.getRegistration).mockResolvedValue({
        pushManager: { getSubscription: () => Promise.resolve(endpoint ? { endpoint } : null) }
    } as unknown as ServiceWorkerRegistration)

describe('usePushSubscription', () => {
    beforeEach(() => {
        mocked(Push.getPushSupport).mockReturnValue('supported')
        mocked(Push.getPermission).mockReturnValue('default')
        device(null)
        mocked(API.usePushGetKeyQuery).mockReturnValue({ data: { publicKey: 'KEY' }, isLoading: false } as never)
        mocked(API.usePushGetStatusQuery).mockReturnValue({
            data: undefined,
            isError: false,
            isLoading: false
        } as never)
        mockPost.mockReset().mockReturnValue({ unwrap: () => Promise.resolve() })
        mocked(API.usePushPostSubscriptionMutation).mockReturnValue([mockPost] as never)
        mocked(API.usePushDeleteSubscriptionMutation).mockReturnValue([jest.fn()] as never)
        mocked(API.usePushPostTestMutation).mockReturnValue([jest.fn()] as never)
    })

    it('is off on a supported device without a subscription', async () => {
        const { result } = renderHook(() => usePushSubscription())

        await waitFor(() => expect(result.current.state).toBe('off'))
    })

    it('is on when the server knows this device for this account', async () => {
        device('https://push.example/a')
        mocked(API.usePushGetStatusQuery).mockReturnValue({
            data: { active: true, devices: 1 },
            isError: false,
            isLoading: false
        } as never)

        const { result } = renderHook(() => usePushSubscription())

        await waitFor(() => expect(result.current.state).toBe('on'))
    })

    it('does not hang in loading when the status request fails', async () => {
        device('https://push.example/a')
        mocked(API.usePushGetStatusQuery).mockReturnValue({ data: undefined, isError: true, isLoading: false } as never)

        const { result } = renderHook(() => usePushSubscription())

        await waitFor(() => expect(result.current.state).toBe('off'))
    })

    it('is unavailable without a service worker or a server key', async () => {
        mocked(Push.getRegistration).mockResolvedValue(null)

        const { result } = renderHook(() => usePushSubscription())

        await waitFor(() => expect(result.current.state).toBe('unavailable'))
    })

    it('is denied when blocked in the browser', async () => {
        mocked(Push.getPermission).mockReturnValue('denied')

        const { result } = renderHook(() => usePushSubscription())

        await waitFor(() => expect(result.current.state).toBe('denied'))
    })

    it('tells a refusal from a failure when turning on', async () => {
        const { result } = renderHook(() => usePushSubscription())
        await waitFor(() => expect(result.current.state).toBe('off'))

        mocked(Push.subscribe).mockRejectedValueOnce(new Error('denied'))
        await act(async () => expect(await result.current.enable()).toBe('denied'))

        mocked(Push.subscribe).mockRejectedValueOnce(new Error('no-worker'))
        await act(async () => expect(await result.current.enable()).toBe('error'))

        mocked(Push.subscribe).mockResolvedValueOnce({ endpoint: 'https://push.example/b' } as PushSubscription)
        await act(async () => expect(await result.current.enable()).toBe('ok'))
        expect(mockPost).toHaveBeenCalledWith({ endpoint: 'https://push.example/b' })
    })
})
