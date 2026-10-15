import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserForm } from './UserForm'

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
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Checkbox: ({ id, checked, onChange, ...rest }: any) => (
        <input
            type={'checkbox'}
            id={id}
            aria-label={rest['aria-label']}
            checked={checked}
            onChange={onChange}
        />
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Input: ({ label, value, onChange, name }: any) => (
        <input
            aria-label={label}
            name={name}
            value={value}
            onChange={onChange ?? (() => undefined)}
        />
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Message: ({ children }: any) => <div>{children}</div>
}))

jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

jest.mock('next-i18next/pages', () => ({
    Trans: () => null,
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/app/store', () => ({
    useAppSelector: () => 'user@example.com'
}))

jest.mock('@/components/ui', () => ({ ScreenSpinner: () => null }))

jest.mock('../push-device-settings', () => ({ PushDeviceSettings: () => null }))

const user = {
    authType: 'google',
    id: 'u1',
    name: 'traveler42',
    settings: { emailComment: true, emailDigest: false, pushLevel: false }
} as unknown as ApiModel.User

describe('UserForm', () => {
    it('shows a switch per channel and type the channel carries, a missing setting as on', () => {
        render(<UserForm values={user} />)

        expect(screen.getAllByRole('checkbox')).toHaveLength(ApiModel.userSettingKeys().length)
        expect(screen.getByLabelText('notification-channel_email: notification-type_photo')).toBeChecked()
        expect(screen.getByLabelText('notification-channel_email: notification-type_digest')).not.toBeChecked()
        expect(screen.getByLabelText('notification-channel_push: notification-type_level')).not.toBeChecked()
        expect(screen.getByLabelText('notification-channel_push: notification-type_achievement')).toBeChecked()
        expect(screen.queryByLabelText('notification-channel_push: notification-type_digest')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('notification-channel_email: notification-type_level')).not.toBeInTheDocument()
    })

    it('sends only the switches the user changed', async () => {
        const onSubmit = jest.fn()

        render(
            <UserForm
                values={user}
                onSubmit={onSubmit}
            />
        )

        fireEvent.click(screen.getByLabelText('notification-channel_email: notification-type_visit'))
        fireEvent.click(screen.getByLabelText('notification-channel_push: notification-type_comment'))
        await act(async () => {
            fireEvent.click(screen.getByText('save'))
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].settings).toStrictEqual({ emailVisit: false, pushComment: false })
    })

    it('sends no settings when only the profile changed', async () => {
        const onSubmit = jest.fn()

        render(
            <UserForm
                values={user}
                onSubmit={onSubmit}
            />
        )

        fireEvent.change(screen.getByRole('textbox', { name: 'input_name' }), { target: { value: 'traveler43' } })
        await act(async () => {
            fireEvent.click(screen.getByText('save'))
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0].settings).toBeUndefined()
        expect(onSubmit.mock.calls[0][0].name).toBe('traveler43')
    })
})
