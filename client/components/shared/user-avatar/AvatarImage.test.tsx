import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'
import { minutesAgo } from '@/utils/helpers'

import { AvatarImage } from './AvatarImage'

jest.mock('next/image', () => {
    const Image = ({
        src,
        alt,
        width,
        height,
        className
    }: {
        src: string
        alt: string
        width: number
        height: number
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

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/helpers', () => ({
    minutesAgo: jest.fn()
}))

const mockMinutesAgo = jest.mocked(minutesAgo)

describe('AvatarImage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('rendering', () => {
        it('renders initials when no user is provided', () => {
            const { container } = render(<AvatarImage />)
            const initialsDiv = container.querySelector('.initialsAvatar')
            expect(initialsDiv).toBeInTheDocument()
            expect(initialsDiv).toHaveTextContent('?')
        })

        it('renders initials when user has no avatar', () => {
            const { container } = render(<AvatarImage user={{ id: 'u1', name: 'Alice' } as ApiModel.User} />)
            const initialsDiv = container.querySelector('.initialsAvatar')
            expect(initialsDiv).toBeInTheDocument()
            expect(initialsDiv).toHaveTextContent('A')
        })

        it('renders initials from first two words of name', () => {
            const { container } = render(<AvatarImage user={{ id: 'u1', name: 'John Doe' } as ApiModel.User} />)
            const initialsDiv = container.querySelector('.initialsAvatar')
            expect(initialsDiv).toBeInTheDocument()
            expect(initialsDiv).toHaveTextContent('JD')
        })

        it('renders the user avatar image when avatar is provided', () => {
            render(<AvatarImage user={{ id: 'u1', name: 'Alice', avatar: '/avatars/alice.jpg' } as ApiModel.User} />)
            expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://img.example.com/avatars/alice.jpg')
        })
    })

    describe('online indicator', () => {
        it('renders the online indicator for recently active user', () => {
            mockMinutesAgo.mockReturnValue(5)
            const { container } = render(
                <AvatarImage
                    user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as ApiModel.User}
                />
            )
            expect(container.querySelector('.online')).toBeInTheDocument()
        })

        it('does not render online indicator when last activity is more than 15 min ago', () => {
            mockMinutesAgo.mockReturnValue(20)
            const { container } = render(
                <AvatarImage
                    user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as ApiModel.User}
                />
            )
            expect(container.querySelector('.online')).not.toBeInTheDocument()
        })

        it('does not render online indicator when hideOnlineIcon is true', () => {
            mockMinutesAgo.mockReturnValue(5)
            const { container } = render(
                <AvatarImage
                    user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as ApiModel.User}
                    hideOnlineIcon={true}
                />
            )
            expect(container.querySelector('.online')).not.toBeInTheDocument()
        })
    })
})
