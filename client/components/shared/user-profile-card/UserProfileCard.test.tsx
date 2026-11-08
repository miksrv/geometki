import React from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserProfileCard } from './UserProfileCard'

dayjs.extend(utc)
dayjs.extend(relativeTime)

jest.mock('simple-react-ui-kit', () => ({
    cn: (...names: unknown[]) => names.filter(Boolean).join(' '),
    Icon: () => null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Tooltip: ({ children }: any) => children
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: { src: string; alt: string }) => (
        // eslint-disable-next-line next/no-img-element
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Link = ({ href, children, className, 'aria-label': ariaLabel, 'aria-current': ariaCurrent }: any) => (
        <a
            href={href}
            className={className}
            aria-label={ariaLabel}
            aria-current={ariaCurrent}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, string | number>) =>
            opts ? `${key}(${Object.values(opts).join(',')})` : key
    })
}))

jest.mock('../level-badge/LevelBadge', () => ({
    LevelBadge: ({ level }: { level: number }) => <span data-testid={'level-badge'}>{level}</span>
}))

jest.mock('@/hooks/useClientOnly', () => () => true)
jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))
jest.mock('@/public/images/no-avatar.png', () => ({ src: '/no-avatar.png' }))

const user: ApiModel.User = {
    activity: { date: '2020-01-01 10:00:00' },
    avatar: 'a.jpg',
    created: { date: '2014-11-12 11:36:18.000000' },
    id: 'u1',
    levelData: { experience: 6796, level: 15, levelExperience: 6600, nextLevel: 8000 },
    name: 'Миша Топчило',
    reputation: 12,
    statistic: { comment: 0, edit: 0, photo: 398, place: 101, rating: 0, visited: 7, visits: 9 },
    website: 'https://example.com'
} as ApiModel.User

describe('UserProfileCard', () => {
    describe('profile', () => {
        it('names the person in the h1 with the facts and the level', () => {
            render(<UserProfileCard user={user} />)

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Миша Топчило')
            expect(screen.getByText(/^user-hero-last-seen\(/)).toBeInTheDocument()
            expect(screen.getByText('user-hero-since(2014)')).toBeInTheDocument()
            expect(screen.getByText('example.com')).toBeInTheDocument()
            expect(screen.getByTestId('level-badge')).toHaveTextContent('15')
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '14')
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'Миша Топчило')
        })

        it('marks a person active in the last minutes as online', () => {
            render(
                <UserProfileCard
                    user={{
                        ...user,
                        activity: { date: dayjs.utc().subtract(3, 'minute').format('YYYY-MM-DD HH:mm:ss') }
                    }}
                />
            )

            expect(screen.getByText('user-hero-online')).toBeInTheDocument()
        })

        it('links the counters to the lists and explains the reputation', () => {
            render(<UserProfileCard user={user} />)

            expect(screen.getByRole('link', { name: /101/ })).toHaveAttribute('href', '/users/u1/places')
            expect(screen.getByRole('link', { name: /398/ })).toHaveAttribute('href', '/users/u1/photos')
            expect(screen.getByRole('link', { name: /user-hero-visited/ })).toHaveAttribute(
                'href',
                '/users/u1/places?show=visited'
            )
            expect(screen.getByLabelText('reputation: 12')).toHaveTextContent('+12')
        })

        it('shows the actions it is given, none without them', () => {
            const { rerender } = render(<UserProfileCard user={user} />)

            expect(screen.queryByRole('button')).not.toBeInTheDocument()

            rerender(
                <UserProfileCard
                    user={user}
                    actions={<button type={'button'}>settings</button>}
                />
            )

            expect(screen.getByRole('button', { name: 'settings' })).toBeInTheDocument()
        })

        it('shows a replaced avatar at once', () => {
            render(
                <UserProfileCard
                    user={user}
                    avatarSrc={'new.jpg'}
                />
            )

            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.test/new.jpg')
        })
    })

    describe('home', () => {
        it('greets by the first name, leads to the profile by the avatar and shows the facts it is given', () => {
            render(
                <UserProfileCard
                    user={user}
                    variant={'home'}
                    facts={['12 actions this week', '3 days in a row']}
                />
            )

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home-welcome-title(Миша)')
            expect(screen.getByRole('link', { name: 'user-card-open-profile' })).toHaveAttribute('href', '/users/u1')
            expect(screen.getByText('12 actions this week')).toBeInTheDocument()
            expect(screen.getByText('3 days in a row')).toBeInTheDocument()
            // The profile's facts stay on the profile: nothing that never changes on the home page
            expect(screen.queryByText(/user-hero-since/)).not.toBeInTheDocument()
            expect(screen.queryByText(/user-hero-last-seen/)).not.toBeInTheDocument()
            expect(screen.queryByText('example.com')).not.toBeInTheDocument()
        })

        it('shows the full bar and the whole experience on the last level', () => {
            render(
                <UserProfileCard
                    user={{ ...user, levelData: { experience: 48210, level: 30, levelExperience: 47500 } }}
                    variant={'home'}
                />
            )

            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
            expect(screen.getByText('home-welcome-experience-max(48 210)')).toBeInTheDocument()
        })
    })

    it('links the pages of the profile at its foot and marks the one shown', () => {
        render(
            <UserProfileCard
                user={user}
                activeSection={'places'}
            />
        )

        const sections = screen.getByRole('navigation', { name: /user-card-sections/ })
        const links = Array.from(sections.querySelectorAll('a'))

        expect(links.map((link) => link.getAttribute('href'))).toStrictEqual([
            '/users/u1',
            '/users/u1/places',
            '/users/u1/achievements'
        ])
        expect(links.map((link) => link.getAttribute('aria-current'))).toStrictEqual([null, 'page', null])
    })

    it('gives the home card the same links, as quick links into the own profile, none marked', () => {
        render(
            <UserProfileCard
                user={user}
                variant={'home'}
            />
        )

        const sections = screen.getByRole('navigation', { name: 'user-card-own-sections' })

        expect(sections.querySelectorAll('a')).toHaveLength(3)
        expect(sections.querySelector('[aria-current]')).toBeNull()
    })

    it('shows no counters, not zeros, when the profile came without its statistic', () => {
        render(<UserProfileCard user={{ ...user, statistic: undefined, reputation: undefined }} />)

        expect(screen.queryByRole('navigation', { name: /user-hero-counters/ })).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/^reputation:/)).not.toBeInTheDocument()
    })

    it('falls back to the default avatar and leaves out what is unknown', () => {
        render(<UserProfileCard user={{ id: 'u2', name: 'Лена' } as ApiModel.User} />)

        expect(screen.getByRole('img')).toHaveAttribute('src', '/no-avatar.png')
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        expect(screen.queryByText(/user-hero-since/)).not.toBeInTheDocument()
    })
})
