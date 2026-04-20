import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UsersList } from './UsersList'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({
        children,
        className,
        title
    }: {
        children?: React.ReactNode
        className?: string
        title?: string
        _footer?: React.ReactNode
        _action?: React.ReactNode
    }) => (
        <div
            className={className}
            data-title={title}
        >
            {children}
        </div>
    ),
    Progress: ({ value, className }: { value?: number; _height?: number; className?: string }) => (
        <div
            data-testid={'progress'}
            data-value={value}
            className={className}
        />
    )
}))

jest.mock('next/image', () => {
    const Image = ({
        src,
        alt,
        width,
        height,
        className
    }: {
        src?: string
        alt?: string
        width?: number
        height?: number
        className?: string
    }) => (
        // eslint-disable-next-line next/no-img-element
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

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/components/ui', () => ({
    Reputation: ({ value }: { value: number }) => <span data-testid={'reputation'}>{value}</span>
}))

jest.mock('@/utils/levels', () => ({
    levelImage: jest.fn().mockReturnValue({ src: '/levels/1.png' }),
    nextLevelPercentage: jest.fn().mockReturnValue(50)
}))

jest.mock('../user-avatar', () => ({
    UserAvatar: ({ user, showName, caption }: { user?: ApiModel.User; showName?: boolean; caption?: string }) => (
        <div data-testid={'user-avatar'}>
            {user?.name}
            {showName && <span data-testid={'user-name-shown'}>{user?.name}</span>}
            {caption && <span data-testid={'user-caption'}>{caption}</span>}
        </div>
    )
}))

const mockUsers: ApiModel.User[] = [
    {
        id: 'u1',
        name: 'Alice',
        reputation: 100,
        levelData: { level: 3, title: 'Explorer', experience: 300, nextLevel: 500 }
    },
    {
        id: 'u2',
        name: 'Bob',
        reputation: 50,
        levelData: { level: 2, title: 'Traveler', experience: 150, nextLevel: 300 }
    }
]

describe('UsersList', () => {
    describe('rendering with users', () => {
        it('renders a UserAvatar for each user', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getAllByTestId('user-avatar')).toHaveLength(2)
        })

        it('renders user names', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
            expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
        })

        it('renders Reputation component for each user', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getAllByTestId('reputation')).toHaveLength(2)
        })

        it('renders reputation values', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getByText('100')).toBeInTheDocument()
            expect(screen.getByText('50')).toBeInTheDocument()
        })

        it('renders Progress component for each user', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getAllByTestId('progress')).toHaveLength(2)
        })

        it('renders level titles', () => {
            render(<UsersList users={mockUsers} />)
            expect(screen.getByText('Explorer')).toBeInTheDocument()
            expect(screen.getByText('Traveler')).toBeInTheDocument()
        })
    })

    describe('empty state', () => {
        it('renders empty state message when no users', () => {
            render(<UsersList />)
            expect(screen.getByText('Тут пока ничего нет')).toBeInTheDocument()
        })

        it('renders empty state when users is empty array', () => {
            render(<UsersList users={[]} />)
            expect(screen.getByText('Тут пока ничего нет')).toBeInTheDocument()
        })
    })
})
