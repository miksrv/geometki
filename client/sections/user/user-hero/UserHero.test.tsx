import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserHero } from './UserHero'

let mockAuthState = { isAuth: false, user: undefined as { id: string } | undefined }

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, link }: any) => <a href={link}>{label}</a>
}))

jest.mock('next/dynamic', () => () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Editor = ({ label }: any) => <button type={'button'}>{label}</button>
    return Editor
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/app/store', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppSelector: (selector: any) => selector({ auth: mockAuthState })
}))

jest.mock('@/components/shared', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UserProfileCard: ({ user, variant, actions, activeSection }: any) => (
        <section
            data-variant={variant}
            data-active={activeSection}
        >
            <h1>{user.name}</h1>
            {actions}
        </section>
    )
}))

jest.mock('@/components/ui', () => ({ Breadcrumbs: () => null }))

const user = { id: 'u1', name: 'Миша' } as ApiModel.User

describe('UserHero', () => {
    beforeEach(() => {
        mockAuthState = { isAuth: false, user: undefined }
    })

    it('shows the profile card without buttons to a visitor, with the page shown', () => {
        render(
            <UserHero
                user={user}
                currentPage={'places'}
            />
        )

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Миша')
        expect(screen.getByRole('heading').parentElement).toHaveAttribute('data-variant', 'profile')
        expect(screen.getByRole('heading').parentElement).toHaveAttribute('data-active', 'places')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'settings' })).not.toBeInTheDocument()
    })

    it('gives the owner the photo change and the settings', () => {
        mockAuthState = { isAuth: true, user: { id: 'u1' } }

        render(<UserHero user={user} />)

        expect(screen.getByRole('button', { name: 'user-hero-change-avatar' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/users/settings')
    })

    it('shows no buttons to another signed-in user', () => {
        mockAuthState = { isAuth: true, user: { id: 'u2' } }

        render(<UserHero user={user} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
