import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

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
        <img src={src} alt={alt} width={width} height={height} className={className} />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, title, onClick, children }: any) => (
        <a href={href} title={title} onClick={onClick}>
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('@/components/shared', () => ({
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

jest.mock('@/features/levels/levels.utils', () => ({
    levelImage: jest.fn().mockReturnValue({ src: '/levels/1.png' })
}))

import { UserMenu } from './UserMenu'

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
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
        })

        it('renders the user name in the popout', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
        })

        it('renders the user level', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByText(/3/)).toBeInTheDocument()
        })

        it('renders the level title', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByText('Explorer')).toBeInTheDocument()
        })

        it('renders the "until next level" text', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            // 500 - 300 = 200 points to next level
            expect(screen.getByText(/200/)).toBeInTheDocument()
        })

        it('renders the my page link', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByTitle('Перейти на мою страницу')).toHaveAttribute('href', '/users/user-1')
        })

        it('renders the settings link', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByTitle('Перейти в настройки')).toHaveAttribute('href', '/users/settings')
        })

        it('renders the logout link', () => {
            render(<UserMenu t={mockT as any} user={mockUser as any} />)
            expect(screen.getByTitle('Выйти')).toBeInTheDocument()
        })
    })

    describe('logout interaction', () => {
        it('calls onLogout when logout link is clicked', () => {
            const onLogout = jest.fn()
            render(<UserMenu t={mockT as any} user={mockUser as any} onLogout={onLogout} />)
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
