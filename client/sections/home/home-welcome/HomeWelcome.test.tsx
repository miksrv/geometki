import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { HomeWelcome } from './HomeWelcome'

jest.mock('simple-react-ui-kit', () => ({
    Progress: ({ value }: { value: number }) => (
        <div
            role={'progressbar'}
            aria-valuenow={value}
        />
    )
}))

jest.mock('next/image', () => {
    const Image = ({ src }: { src: string }) => (
        <img
            src={src}
            alt={''}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, className, 'aria-label': ariaLabel }: any) => (
        <a
            href={href}
            className={className}
            aria-label={ariaLabel}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, string | number>) =>
            opts ? `${key}(${Object.values(opts).join(',')})` : key
    })
}))

jest.mock('@/components/shared', () => ({
    LevelBadge: ({ level }: { level: number }) => <span data-testid={'level-badge'}>{level}</span>
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))
jest.mock('@/public/images/no-avatar.png', () => ({ src: '/no-avatar.png' }))

const user: ApiModel.User = {
    avatar: 'a.jpg',
    id: 'u1',
    levelData: { experience: 6796, level: 15, levelExperience: 6600, nextLevel: 8000 },
    created: { date: '2014-11-12 11:36:18.000000' },
    name: 'Миша Топчило',
    statistic: { comment: 0, edit: 0, photo: 398, place: 101, rating: 0, visited: 7 }
} as ApiModel.User

describe('HomeWelcome', () => {
    it('greets the user by the first name with the level and what is left to the next one', () => {
        render(<HomeWelcome user={user} />)

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home-welcome-title(Миша)')
        expect(
            screen.getByText('home-welcome-since(2014) · home-welcome-experience-left(1 204,16)')
        ).toBeInTheDocument()
        expect(screen.getByTestId('level-badge')).toHaveTextContent('15')
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '14')
        expect(screen.getByText('home-welcome-experience(196,1 400)')).toBeInTheDocument()
    })

    it('shows a full bar and the whole experience on the last level', () => {
        render(<HomeWelcome user={{ ...user, levelData: { experience: 48210, level: 30, levelExperience: 47500 } }} />)

        expect(screen.getByText('home-welcome-since(2014)')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
        expect(screen.getByText('home-welcome-experience-max(48 210)')).toBeInTheDocument()
    })

    it('links the avatar to the profile and every counter to its list', () => {
        const { container } = render(<HomeWelcome user={user} />)

        expect(screen.getByRole('link', { name: 'Миша Топчило' })).toHaveAttribute('href', '/users/u1')
        // The avatar is decorative: the link around it carries the name
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/a.jpg')
        expect(screen.getByRole('link', { name: /101/ })).toHaveAttribute('href', '/users/u1/places')
        expect(screen.getByRole('link', { name: /398/ })).toHaveAttribute('href', '/users/u1/photos')
        expect(screen.getByRole('link', { name: /home-welcome-visited/ })).toHaveAttribute('href', '/users/u1/visited')
    })

    it('shows the default avatar and leaves out what the user has no data for', () => {
        const { container } = render(<HomeWelcome user={{ id: 'u2', name: 'Лена' } as ApiModel.User} />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/no-avatar.png')
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        expect(screen.queryByTestId('level-badge')).not.toBeInTheDocument()
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })
})
