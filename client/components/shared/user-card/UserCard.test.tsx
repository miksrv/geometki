import React from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'
import { buildPlaceUrl } from '@/utils/helpers'

import { UserCard } from './UserCard'

dayjs.extend(utc)
dayjs.extend(relativeTime)

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
    const Link = ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a
            href={href}
            {...props}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

// The default text with its {{values}}: the tests read what a visitor reads
jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, fallback?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
            const text = typeof fallback === 'string' ? fallback : key
            const vars = (typeof fallback === 'object' ? fallback : values) ?? {}
            return text.replace(/{{(\w+)}}/g, (_, name: string) => String(vars[name]))
        }
    })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

jest.mock('@/hooks/useClientOnly', () => ({ __esModule: true, default: () => true }))

jest.mock('../category-icon', () => ({
    CategoryIcon: ({ category }: { category: string }) => <span data-testid={`category-${category}`} />
}))

const place = (id: string): ApiModel.UserPlacePreview => ({
    category: 'waterfall' as ApiModel.Categories,
    cover: { preview: `uploads/places/${id}/cover_preview.jpg` },
    id,
    slug: `slug-${id}`,
    title: `Place ${id}`
})

const user = (fields: Partial<ApiModel.User> = {}): ApiModel.User => ({
    activity: { date: '2020-01-01 10:00:00' },
    created: { date: '2022-05-01 10:00:00' },
    id: 'u1',
    levelData: { experience: 1316, level: 7, levelExperience: 1000, nextLevel: 1350 },
    name: 'Мария Соколова',
    reputation: 12,
    statistic: { comment: 0, edit: 0, photo: 40, place: 9, rating: 0, visited: 3, visits: 5 },
    ...fields
})

describe('UserCard', () => {
    it('links the name to the profile and the counts to its tabs', () => {
        render(<UserCard user={user()} />)

        expect(screen.getByRole('link', { name: 'Мария Соколова' })).toHaveAttribute('href', '/users/u1')
        expect(screen.getByRole('link', { name: /9 user-card-places/ })).toHaveAttribute('href', '/users/u1/places')
        expect(screen.getByRole('link', { name: /40 user-card-photos/ })).toHaveAttribute('href', '/users/u1/photos')
        expect(screen.getByRole('link', { name: /3 user-card-visited/ })).toHaveAttribute('href', '/users/u1/visited')
    })

    it('shows the level tier and the progress within the level', () => {
        render(<UserCard user={user()} />)

        expect(screen.getByText('levelTier.2')).toBeInTheDocument()
        expect(screen.getByText('316 / 350')).toBeInTheDocument()
    })

    it('turns the last cover into "+N" leading to all the places', () => {
        render(<UserCard user={user({ places: ['a', 'b', 'c', 'd'].map(place) })} />)

        expect(screen.getByRole('link', { name: 'Place a' })).toHaveAttribute('href', buildPlaceUrl('a', 'slug-a'))
        expect(screen.getByRole('link', { name: 'Все места: 9' })).toHaveAttribute('href', '/users/u1/places')
        expect(screen.getByText('+6')).toBeInTheDocument()
    })

    it('says so when the person has no places', () => {
        render(<UserCard user={user({ places: [], statistic: { ...user().statistic!, place: 0 } })} />)

        expect(screen.getByText('Пока без мест')).toBeInTheDocument()
    })

    it('shows no strip when the list did not ask for the places', () => {
        render(<UserCard user={user()} />)

        expect(screen.queryByRole('list')).not.toBeInTheDocument()
        expect(screen.queryByText('Пока без мест')).not.toBeInTheDocument()
    })

    it('says the person is online after a request in the last minutes', () => {
        render(
            <UserCard
                user={user({ activity: { date: dayjs.utc().subtract(3, 'minute').format('YYYY-MM-DD HH:mm:ss') } })}
            />
        )

        expect(screen.getByText('на сайте')).toBeInTheDocument()
    })

    it('links the count when the places have no covers', () => {
        render(<UserCard user={user({ places: [] })} />)

        expect(screen.getByRole('link', { name: '9 мест' })).toHaveAttribute('href', '/users/u1/places')
    })

    it('names a place without a title by its category', () => {
        render(<UserCard user={user({ places: [{ ...place('a'), title: '' }] })} />)

        expect(screen.getByRole('link', { name: 'waterfall' })).toBeInTheDocument()
    })

    it('shows the whole experience on the last level', () => {
        render(
            <UserCard
                user={user({ levelData: { experience: 99000, level: 30, levelExperience: 90000, nextLevel: null } })}
            />
        )

        expect(screen.getByText('99 000')).toBeInTheDocument()
    })

    it('numbers the card only in a ranking', () => {
        const { rerender } = render(<UserCard user={user()} />)
        expect(screen.queryByText('#2')).not.toBeInTheDocument()

        rerender(
            <UserCard
                user={user()}
                rank={2}
            />
        )
        expect(screen.getByText('#2')).toBeInTheDocument()
    })

    it('renders the dense row without the counts', () => {
        render(
            <UserCard
                user={user()}
                variant={'row'}
                headingLevel={3}
            />
        )

        expect(screen.getByRole('heading', { level: 3, name: 'Мария Соколова' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /9 user-card-places/ })).not.toBeInTheDocument()
    })
})
