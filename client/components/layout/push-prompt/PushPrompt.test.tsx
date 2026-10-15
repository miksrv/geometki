import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import usePushSubscription from '@/hooks/usePushSubscription'
import * as LocalStorage from '@/utils/localstorage'

import { isPushPromptDismissed, PushPrompt } from './PushPrompt'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick, disabled }: any) => (
        <button
            type={'button'}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    )
}))

jest.mock('next-i18next/pages', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const mockRouter = { pathname: '/places/[slug]' }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

const mockState = { application: { pushPromptRequested: true }, auth: { isAuth: true } }
const mockDispatch = jest.fn()
jest.mock('@/app/store', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState)
}))

jest.mock('@/app/applicationSlice', () => ({ dismissPushPrompt: () => ({ type: 'dismiss' }) }))
jest.mock('@/app/notificationSlice', () => ({ NotifyReplace: (payload: unknown) => ({ payload, type: 'notify' }) }))
jest.mock('@/hooks/usePushSubscription', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(() => ''), setItem: jest.fn() }))

const mockStatus = { data: undefined as { active: boolean; devices: number } | undefined }
const mockDelete = jest.fn()
jest.mock('@/api', () => ({
    API: {
        usePushDeleteSubscriptionMutation: () => [mockDelete],
        usePushGetStatusQuery: () => mockStatus
    }
}))

const mockSubscription = { endpoint: null as string | null }
const mockUnsubscribe = jest.fn()
jest.mock('@/utils/push', () => ({
    getSubscription: () => Promise.resolve(mockSubscription.endpoint ? { endpoint: mockSubscription.endpoint } : null),
    unsubscribe: () => mockUnsubscribe()
}))

const usePush = jest.mocked(usePushSubscription)
const mockEnable = jest.fn()

const mockPush = (state: string) =>
    usePush.mockReturnValue({
        busy: false,
        devices: 0,
        disable: jest.fn(),
        enable: mockEnable,
        sendTest: jest.fn(),
        state
    } as never)

describe('PushPrompt', () => {
    beforeEach(() => {
        mockState.application.pushPromptRequested = true
        mockState.auth.isAuth = true
        mockRouter.pathname = '/places/[slug]'
        mockDispatch.mockReset()
        mockEnable.mockReset()
        jest.mocked(LocalStorage.getItem).mockReturnValue('')
        jest.mocked(LocalStorage.setItem).mockReset()
        mockPush('off')
        mockStatus.data = undefined
        mockSubscription.endpoint = null
        mockDelete.mockReset()
        mockUnsubscribe.mockReset().mockResolvedValue('https://push.example/a')
    })

    it('offers push after an action when it can be turned on', () => {
        render(<PushPrompt />)

        expect(screen.getByRole('region')).toHaveTextContent('push-prompt-title')
    })

    it.each([
        ['nothing was done yet', () => (mockState.application.pushPromptRequested = false)],
        ['a guest', () => (mockState.auth.isAuth = false)],
        ['push is already on', () => mockPush('on')],
        ['push is blocked', () => mockPush('denied')],
        ['iOS outside the Home Screen', () => mockPush('ios-install')],
        ['the settings page', () => (mockRouter.pathname = '/users/settings')],
        ['declined for good', () => jest.mocked(LocalStorage.getItem).mockReturnValue('never')]
    ])('is not shown: %s', (_, arrange) => {
        arrange()
        render(<PushPrompt />)

        expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('ends the request when there is nothing to offer, so it cannot pop up later', () => {
        mockPush('on')
        render(<PushPrompt />)

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'dismiss' })
    })

    it('keeps the request while the state is loading', () => {
        mockPush('loading')
        render(<PushPrompt />)

        expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('turns push on from the click', async () => {
        mockEnable.mockResolvedValue('ok')
        render(<PushPrompt />)

        await act(async () => {
            fireEvent.click(screen.getByText('push-prompt-enable'))
        })

        expect(mockEnable).toHaveBeenCalledTimes(1)
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'dismiss' })
        expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('stays open after a technical failure, to try again', async () => {
        mockEnable.mockResolvedValue('error')
        render(<PushPrompt />)

        await act(async () => {
            fireEvent.click(screen.getByText('push-prompt-enable'))
        })

        expect(screen.getByRole('region')).toBeInTheDocument()
        expect(LocalStorage.setItem).not.toHaveBeenCalled()
    })

    it('stops offering after a refusal in the browser prompt', async () => {
        mockEnable.mockResolvedValue('denied')
        render(<PushPrompt />)

        await act(async () => {
            fireEvent.click(screen.getByText('push-prompt-enable'))
        })

        expect(jest.mocked(LocalStorage.setItem).mock.calls[0][1]).toBe('never')
    })

    it('Escape puts the offer off', () => {
        render(<PushPrompt />)

        fireEvent.keyDown(window, { key: 'Escape' })

        expect(Number(jest.mocked(LocalStorage.setItem).mock.calls[0][1])).toBeGreaterThan(Date.now())
    })

    it('drops the subscription of this device when it belongs to another account', async () => {
        mockState.application.pushPromptRequested = false
        mockSubscription.endpoint = 'https://push.example/a'
        mockStatus.data = { active: false, devices: 0 }

        await act(async () => {
            render(<PushPrompt />)
        })

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
        expect(mockDelete).toHaveBeenCalledWith('https://push.example/a')
    })

    it('keeps the subscription of this device for the signed-in account', async () => {
        mockSubscription.endpoint = 'https://push.example/a'
        mockStatus.data = { active: true, devices: 1 }

        await act(async () => {
            render(<PushPrompt />)
        })

        expect(mockUnsubscribe).not.toHaveBeenCalled()
    })

    it('"Not now" snoozes for two weeks, "Don\'t offer" for good', () => {
        const { unmount } = render(<PushPrompt />)
        fireEvent.click(screen.getByText('push-prompt-later'))

        const snoozed = Number(jest.mocked(LocalStorage.setItem).mock.calls[0][1])
        expect(snoozed).toBeGreaterThan(Date.now() + 13 * 24 * 3600 * 1000)
        unmount()

        render(<PushPrompt />)
        fireEvent.click(screen.getByText('push-prompt-never'))
        expect(jest.mocked(LocalStorage.setItem).mock.calls[1][1]).toBe('never')
    })

    it('knows a running snooze from an expired one', () => {
        expect(isPushPromptDismissed('never')).toBe(true)
        expect(isPushPromptDismissed(String(Date.now() + 1000))).toBe(true)
        expect(isPushPromptDismissed(String(Date.now() - 1000))).toBe(false)
        expect(isPushPromptDismissed('')).toBe(false)
    })
})
