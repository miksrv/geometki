import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import usePushSubscription from '@/hooks/usePushSubscription'

import { PushDeviceSettings } from './PushDeviceSettings'

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

const mockDispatch = jest.fn()
jest.mock('@/app/store', () => ({ useAppDispatch: () => mockDispatch }))
jest.mock('@/app/notificationSlice', () => ({ NotifyReplace: (payload: unknown) => ({ payload, type: 'notify' }) }))
jest.mock('@/hooks/usePushSubscription', () => ({ __esModule: true, default: jest.fn() }))

const usePush = jest.mocked(usePushSubscription)
const actions = { disable: jest.fn(), enable: jest.fn(), sendTest: jest.fn() }

const mockPush = (state: string) => usePush.mockReturnValue({ busy: false, devices: 1, ...actions, state } as never)

describe('PushDeviceSettings', () => {
    beforeEach(() => {
        Object.values(actions).forEach((action) => action.mockReset())
        mockDispatch.mockReset()
    })

    it('offers to turn push on', async () => {
        mockPush('off')
        actions.enable.mockResolvedValue('ok')
        render(<PushDeviceSettings />)

        expect(screen.getByText('push-state_off')).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByText('push-enable'))
        })

        expect(actions.enable).toHaveBeenCalledTimes(1)
        expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ message: 'push-enabled', type: 'success' })
    })

    it('says nothing extra after a refusal in the browser prompt', async () => {
        mockPush('off')
        actions.enable.mockResolvedValue('denied')
        render(<PushDeviceSettings />)

        await act(async () => {
            fireEvent.click(screen.getByText('push-enable'))
        })

        expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('when on: a test and turning off', async () => {
        mockPush('on')
        actions.sendTest.mockResolvedValue(false)
        render(<PushDeviceSettings />)

        await act(async () => {
            fireEvent.click(screen.getByText('push-test'))
        })
        expect(mockDispatch.mock.calls[0][0].payload).toMatchObject({ message: 'push-test-failed', type: 'error' })

        fireEvent.click(screen.getByText('push-disable'))
        expect(actions.disable).toHaveBeenCalledTimes(1)
    })

    it.each(['denied', 'ios-install', 'unsupported', 'unavailable'])('explains "%s" without buttons', (state) => {
        mockPush(state)
        render(<PushDeviceSettings />)

        expect(screen.getByText(`push-state_${state}`)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows nothing while loading', () => {
        mockPush('loading')
        const { container } = render(<PushDeviceSettings />)

        expect(container).toBeEmptyDOMElement()
    })
})
