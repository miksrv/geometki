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
    ...jest.requireActual('@/components/ui/form-sections'),
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

// The cards' tops on the screen: jsdom lays nothing out
const cardTops: Record<string, number> = { notifications: 700, profile: 64, security: 1400 }

beforeEach(() => {
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return { top: cardTops[this.id] ?? 0 } as DOMRect
    })
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0)
        return 0
    })
})

afterEach(() => {
    jest.restoreAllMocks()
    cardTops.notifications = 700
    cardTops.profile = 64
    cardTops.security = 1400
})

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

    it('brings the first field with an error into view on save', async () => {
        const onSubmit = jest.fn()
        Element.prototype.scrollIntoView = jest.fn()

        render(
            <UserForm
                values={user}
                onSubmit={onSubmit}
            />
        )

        fireEvent.change(screen.getByDisplayValue('traveler42'), { target: { value: '' } })
        await act(async () => {
            fireEvent.click(screen.getByText('save'))
        })

        expect(onSubmit).not.toHaveBeenCalled()
        expect(document.activeElement).toHaveAttribute('name', 'name')
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
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

    it('marks the part the page is scrolled to', () => {
        render(<UserForm values={user} />)

        cardTops.profile = -600
        cardTops.notifications = 40
        cardTops.security = 700
        act(() => {
            window.dispatchEvent(new Event('scroll'))
        })

        expect(screen.getByRole('link', { name: 'settings-section-notifications' })).toHaveAttribute(
            'aria-current',
            'location'
        )
        expect(screen.getByRole('link', { name: 'settings-section-profile' })).not.toHaveAttribute('aria-current')
    })

    it('marks the parts once the cards replace the skeleton', () => {
        const { rerender } = render(<UserForm />)

        cardTops.profile = -600
        cardTops.notifications = 40
        rerender(<UserForm values={user} />)
        act(() => {
            window.dispatchEvent(new Event('scroll'))
        })

        expect(screen.getByRole('link', { name: 'settings-section-notifications' })).toHaveAttribute(
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
