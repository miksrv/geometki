import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { UserMenu } from './UserMenu'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    Popout: ({ trigger, children }: any) => (
        <div>
            <div data-testid={'popout-trigger'}>{trigger}</div>
            <div data-testid={'popout-content'}>{children}</div>
        </div>
    )
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height, className }: any) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, title, onClick, children }: any) => (
        <a
            href={href}
            title={title}
            onClick={onClick}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('@/components/shared', () => ({
    LevelProgress: ({ levelData }: any) => (
        <div data-testid={'level-progress'}>
            <span data-testid={'level-number'}>{levelData?.level}</span>
        </div>
    ),
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

const mockT = (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key

const mockUser = {
    id: 'user-1',
    name: 'Alice',
    levelData: {
        level: 3,
        title: 'Explorer',
        experience: 300,
        nextLevel: 500
    }
}

describe('UserMenu', () => {
    describe('rendering', () => {
        it('renders the UserAvatar as the trigger', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
        })

        it('renders the user name in the popout', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
        })

        it('renders the user level via LevelProgress', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getByTestId('level-progress')).toBeInTheDocument()
            expect(screen.getByTestId('level-number')).toHaveTextContent('3')
        })

        it('renders the my page link', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getByTitle('Перейти на мою страницу')).toHaveAttribute('href', '/users/user-1')
        })

        it('renders the settings link', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getByTitle('Перейти в настройки')).toHaveAttribute('href', '/users/settings')
        })

        it('does not render admin links for a regular user', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.queryByText('Настройки наград')).not.toBeInTheDocument()
        })

        it('renders admin links for an admin user', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={{ ...mockUser, role: 'admin' } as any}
                />
            )
            expect(screen.getByText('Настройки наград').closest('a')).toHaveAttribute('href', '/admin/achievements')
            expect(screen.getByText('Отправленные письма').closest('a')).toHaveAttribute('href', '/admin/sending-mail')
        })

        it('renders the logout link', () => {
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                />
            )
            expect(screen.getByTitle('Выйти')).toBeInTheDocument()
        })
    })

    describe('logout interaction', () => {
        it('calls onLogout when logout link is clicked', () => {
            const onLogout = jest.fn()
            render(
                <UserMenu
                    t={mockT as any}
                    user={mockUser as any}
                    onLogout={onLogout}
                />
            )
            fireEvent.click(screen.getByTitle('Выйти'))
            expect(onLogout).toHaveBeenCalledTimes(1)
        })
    })

    describe('without user', () => {
        it('renders without crashing when user is undefined', () => {
            const { container } = render(<UserMenu t={mockT as any} />)
            expect(container.firstChild).toBeInTheDocument()
        })
    })
})
