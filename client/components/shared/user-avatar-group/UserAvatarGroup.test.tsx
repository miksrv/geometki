import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserAvatarGroup } from './UserAvatarGroup'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next', () => ({
    Trans: ({ i18nKey, values }: { i18nKey: string; values?: { count?: number } }) => (
        <span>{`${i18nKey}:${String(values?.count)}`}</span>
    )
}))

jest.mock('next-i18next/pages', () => ({
    Trans: ({ i18nKey, values }: { i18nKey: string; values?: { count?: number } }) => (
        <span>{`${i18nKey}:${String(values?.count)}`}</span>
    )
}))

jest.mock('../user-avatar', () => ({
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

const mockUsers: ApiModel.User[] = [
    { id: 'u1', name: 'Alice' },
    { id: 'u2', name: 'Bob' }
]

describe('UserAvatarGroup', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<UserAvatarGroup />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders a UserAvatar for each user', () => {
            render(<UserAvatarGroup users={mockUsers} />)
            expect(screen.getAllByTestId('user-avatar')).toHaveLength(2)
        })

        it('renders user names', () => {
            render(<UserAvatarGroup users={mockUsers} />)
            expect(screen.getByText('Alice')).toBeInTheDocument()
            expect(screen.getByText('Bob')).toBeInTheDocument()
        })

        it('applies custom className', () => {
            const { container } = render(<UserAvatarGroup className={'custom-group'} />)
            expect(container.firstChild).toHaveClass('custom-group')
        })
    })

    describe('totalCount', () => {
        it('renders +N badge when totalCount is between 1 and 99', () => {
            render(<UserAvatarGroup totalCount={5} />)
            expect(screen.getByText('+5')).toBeInTheDocument()
        })

        it('renders +N text for counts over 99', () => {
            render(<UserAvatarGroup totalCount={150} />)
            expect(screen.getByText('+150')).toBeInTheDocument()
        })

        it('renders Trans component for counts over 99', () => {
            render(<UserAvatarGroup totalCount={150} />)
            expect(screen.getByText(/more-count-travelers/)).toBeInTheDocument()
        })

        it('does not render +N badge when totalCount is undefined', () => {
            const { container } = render(<UserAvatarGroup />)
            expect(container.querySelector('.totalCountAvatar')).not.toBeInTheDocument()
        })
    })
})
