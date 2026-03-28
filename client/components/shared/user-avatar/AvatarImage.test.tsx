import React from 'react'

import { render, screen } from '@testing-library/react'

import { minutesAgo } from '@/utils/helpers'

import { AvatarImage } from './AvatarImage'

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

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/public/images/no-avatar.png', () => ({ src: '/no-avatar.png' }), { virtual: true })

jest.mock('@/utils/helpers', () => ({
    minutesAgo: jest.fn()
}))

const mockMinutesAgo = jest.mocked(minutesAgo)

describe('AvatarImage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('rendering', () => {
        it('renders an image element', () => {
            render(<AvatarImage />)
            expect(screen.getByRole('presentation')).toBeInTheDocument()
        })

        it('renders the default avatar when no user is provided', () => {
            render(<AvatarImage />)
            expect(screen.getByRole('presentation')).toHaveAttribute('src', '/no-avatar.png')
        })

        it('renders the default avatar when user has no avatar', () => {
            render(<AvatarImage user={{ id: 'u1', name: 'Alice' } as any} />)
            expect(screen.getByRole('presentation')).toHaveAttribute('src', '/no-avatar.png')
        })

        it('renders the user avatar when avatar is provided', () => {
            render(<AvatarImage user={{ id: 'u1', name: 'Alice', avatar: '/avatars/alice.jpg' } as any} />)
            expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://img.example.com/avatars/alice.jpg')
        })
    })

    describe('online indicator', () => {
        it('renders the online indicator for recently active user', () => {
            mockMinutesAgo.mockReturnValue(5)
            const { container } = render(
                <AvatarImage user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as any} />
            )
            expect(container.querySelector('.online')).toBeInTheDocument()
        })

        it('does not render online indicator when last activity is more than 15 min ago', () => {
            mockMinutesAgo.mockReturnValue(20)
            const { container } = render(
                <AvatarImage user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as any} />
            )
            expect(container.querySelector('.online')).not.toBeInTheDocument()
        })

        it('does not render online indicator when hideOnlineIcon is true', () => {
            mockMinutesAgo.mockReturnValue(5)
            const { container } = render(
                <AvatarImage
                    user={{ id: 'u1', name: 'Alice', activity: { date: '2026-03-27T10:00:00Z' } } as any}
                    hideOnlineIcon={true}
                />
            )
            expect(container.querySelector('.online')).not.toBeInTheDocument()
        })
    })
})
