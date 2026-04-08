import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserAvatar } from './UserAvatar'

jest.mock('next/link', () => {
    const Link = ({ href, children, title }: { href: string; children: React.ReactNode; title?: string }) => (
        <a
            href={href}
            title={title}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
        // eslint-disable-next-line next/no-img-element
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key
    })
}))

// Mock sub-components and utilities
jest.mock('./AvatarImage', () => ({
    AvatarImage: ({ user }: { user?: ApiModel.User }) => <div data-testid={'avatar-image'}>{user?.name}</div>
}))

jest.mock('@/public/images/no-avatar.png', () => ({ src: '/no-avatar.png' }), { virtual: true })

const user: ApiModel.User = { id: 'user-1', name: 'Alice', avatar: '/avatars/alice.jpg' }

describe('UserAvatar', () => {
    describe('without user', () => {
        it('renders initials placeholder when user is undefined', () => {
            const { container } = render(<UserAvatar />)
            const initialsDiv = container.querySelector('.initialsAvatar')
            expect(initialsDiv).toBeInTheDocument()
            expect(initialsDiv).toHaveTextContent('?')
        })

        it('renders initials when user has no id', () => {
            const { container } = render(<UserAvatar user={{ id: '', name: 'No ID' } as ApiModel.User} />)
            const initialsDiv = container.querySelector('.initialsAvatar')
            expect(initialsDiv).toBeInTheDocument()
            expect(initialsDiv).toHaveTextContent('NI')
        })
    })

    describe('with user', () => {
        it('renders a link to the user profile', () => {
            render(<UserAvatar user={user} />)
            const link = screen.getByRole('link')
            expect(link).toHaveAttribute('href', '/users/user-1')
        })

        it('renders the AvatarImage component', () => {
            render(<UserAvatar user={user} />)
            expect(screen.getByTestId('avatar-image')).toBeInTheDocument()
        })
    })

    describe('disableLink prop', () => {
        it('does not render a link when disableLink is true', () => {
            render(
                <UserAvatar
                    user={user}
                    disableLink
                />
            )
            expect(screen.queryByRole('link')).not.toBeInTheDocument()
        })
    })

    describe('showName prop', () => {
        it('shows the user name when showName is true', () => {
            render(
                <UserAvatar
                    user={user}
                    showName
                />
            )
            // The name link in the info section — there may be multiple "Alice" elements
            // (AvatarImage mock also renders user.name), so check for the link
            const links = screen.getAllByRole('link')
            const nameLink = links.find(
                (l) => l.textContent === 'Alice' && (l as HTMLAnchorElement).href.includes('/users/user-1')
            )
            expect(nameLink).toBeInTheDocument()
        })

        it('shows guest text when showName is true but no user', () => {
            render(<UserAvatar showName />)
            // The t mock returns defaultValue for 'guest-user'
            expect(screen.getByText('Гость')).toBeInTheDocument()
        })

        it('shows a caption when provided', () => {
            render(
                <UserAvatar
                    user={user}
                    showName
                    caption={'Admin'}
                />
            )
            expect(screen.getByText('Admin')).toBeInTheDocument()
        })
    })
})
