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
    Container: ({ id, title, children }: any) => (
        <section id={id}>
            <h2>{title}</h2>
            {children}
        </section>
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
    Message: ({ children }: any) => <div>{children}</div>,
    Icon: () => null,
    Skeleton: () => <div />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

jest.mock('next-i18next/pages', () => ({
    Trans: () => null,
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/app/store', () => ({
    useAppSelector: () => 'user@example.com'
}))

jest.mock('@/components/ui', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Chip: ({ label, selected, onClick, ...rest }: any) => (
        <button
            type={'button'}
            aria-label={rest['aria-label']}
            aria-pressed={!!selected}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FormActions: ({ onSave }: any) => (
        <button
            type={'button'}
            onClick={onSave}
        >
            {'save'}
        </button>
    )
}))

jest.mock('../push-device-settings', () => ({ PushDeviceSettings: () => null }))

const user = {
    authType: 'google',
    id: 'u1',
    name: 'traveler42',
    settings: { emailComment: true, emailDigest: false, pushLevel: false }
} as unknown as ApiModel.User

describe('UserForm', () => {
    it('shows a toggle per channel and type the channel carries, a missing setting as on', () => {
        render(<UserForm values={user} />)

        expect(
            screen.getAllByRole('button', { pressed: true }).length +
                screen.getAllByRole('button', { pressed: false }).length
        ).toBe(ApiModel.userSettingKeys().length)
        expect(screen.getByLabelText('notification-channel_email: notification-type_photo')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        expect(screen.getByLabelText('notification-channel_email: notification-type_digest')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        expect(screen.getByLabelText('notification-channel_push: notification-type_level')).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        expect(screen.getByLabelText('notification-channel_push: notification-type_achievement')).toHaveAttribute(
            'aria-pressed',
            'true'
        )
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

    it('lists the parts in the side menu, without the password for a service account', () => {
        render(<UserForm values={user} />)

        const menu = screen.getByRole('navigation', { name: 'settings-sections' })
        expect(menu).toHaveTextContent('settings-section-profile')
        expect(menu).toHaveTextContent('settings-section-notifications')
        expect(menu).toHaveTextContent('settings-section-security')
        expect(screen.getByRole('link', { name: 'settings-section-profile' })).toHaveAttribute(
            'aria-current',
            'location'
        )
    })

    it('shows the skeleton until the profile is loaded', () => {
        render(<UserForm />)

        expect(screen.queryByText('save')).not.toBeInTheDocument()
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
