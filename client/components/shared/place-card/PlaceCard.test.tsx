import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlaceCard } from './PlaceCard'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, title, children, className }: any) => (
        <a
            href={href}
            title={title}
            className={className}
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
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

jest.mock('@/utils/address', () => ({
    addressToString: jest.fn((address?: unknown) =>
        address
            ? [
                  { type: 'country', id: 'ru', name: 'Russia' },
                  { type: 'region', id: 'msk', name: 'Moscow Oblast' }
              ]
            : undefined
    )
}))

jest.mock('@/utils/helpers', () => ({
    addDecimalPoint: jest.fn((value: number) => value.toFixed(1)),
    buildLocationHref: jest.fn(({ type, id }: { type: string; id: number }) => `/places?${type}=${id}`),
    buildPlaceUrl: jest.requireActual('@/utils/place').buildPlaceUrl,
    dateToUnixTime: jest.fn().mockReturnValue(1700000000),
    getLandingFlags: jest.fn().mockReturnValue({ categories: false, combinations: false, locations: false }),
    numberFormatter: jest.fn((value: number) => String(value)),
    removeMarkdown: jest.requireActual('@/utils/text').removeMarkdown
}))

jest.mock('@/components/shared/category-icon', () => ({
    CategoryIcon: ({ category, size }: any) => (
        <span
            data-testid={'category-icon'}
            data-name={category}
            data-size={size}
        />
    )
}))

jest.mock('./PlaceCardBookmark', () => ({
    PlaceCardBookmark: ({ known }: { known?: boolean }) => (
        <button
            data-testid={'card-bookmark'}
            aria-pressed={!!known}
        />
    )
}))

const place: ApiModel.PlaceListItem = {
    id: 'p1',
    slug: 'cool-cave',
    title: 'Cool Cave',
    lat: 55,
    lon: 37,
    rating: 4.5,
    distance: 1.2,
    views: 300,
    photos: 4,
    category: 'cave' as ApiModel.Categories,
    cover: { preview: 'covers/p1-preview.jpg', full: 'covers/p1-full.jpg' },
    updated: { date: '2026-10-06T12:00:00+00:00', timezone_type: 3, timezone: 'UTC' },
    address: { country: { id: 1, name: 'Russia', type: 'country' } } as ApiModel.Place['address']
}

describe('PlaceCard', () => {
    describe('tile (default)', () => {
        it('renders the title as an h2 linking to the place', () => {
            render(<PlaceCard place={place} />)

            expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Cool Cave')
            expect(screen.getAllByRole('link', { name: 'Cool Cave' })[0]).toHaveAttribute(
                'href',
                '/places/p1-cool-cave'
            )
        })

        it('renders the cover with a cache-busting key, named for image search inside the hidden cover link', () => {
            const { container } = render(<PlaceCard place={place} />)

            const cover = container.querySelector('img')
            expect(cover).toHaveAttribute('src', 'https://img.test/covers/p1-preview.jpg?d=1700000000')
            expect(cover).toHaveAttribute('alt', 'Cool Cave')
        })

        it('shows neither who added the place nor when', () => {
            render(<PlaceCard place={{ ...place, category: undefined }} />)

            expect(screen.queryByText(/2026/)).not.toBeInTheDocument()
        })

        it('shows the category as an icon over the cover, without its name', () => {
            render(<PlaceCard place={place} />)

            expect(screen.getByTestId('category-icon')).toHaveAttribute('data-name', 'cave')
            expect(screen.getByTestId('category-icon')).toHaveAttribute('data-size', '24')
            expect(screen.queryByText('Caves')).not.toBeInTheDocument()
        })

        it('renders the address links and stats in the fixed order', () => {
            const { container } = render(<PlaceCard place={place} />)

            expect(screen.getByRole('link', { name: /Russia/ })).toHaveAttribute('href', '/places?country=ru')

            const stats = Array.from(container.querySelectorAll('.tileStat')).map((stat) => stat.textContent)
            expect(stats.map((text) => text?.replace(/\s/g, ' '))).toStrictEqual(['4.5', '1.2 km', '300', '4'])
            expect(screen.getByTestId('icon-StarFilled')).toBeInTheDocument()
        })

        it('hides zero stats', () => {
            const { container } = render(
                <PlaceCard place={{ ...place, rating: 0, distance: 0, views: 0, photos: 0 }} />
            )

            expect(container.querySelectorAll('.tileStat')).toHaveLength(0)
        })

        it('still renders an article without cover, category or address', () => {
            const { container } = render(<PlaceCard place={{ id: 'p2', title: 'Bare', lat: 1, lon: 1 }} />)

            expect(screen.getByRole('article')).toBeInTheDocument()
            expect(container.querySelector('img')).not.toBeInTheDocument()
            expect(screen.queryByTestId('category-icon')).not.toBeInTheDocument()
        })

        it('puts the bookmark over the cover, with the state the list sent', () => {
            render(<PlaceCard place={{ ...place, bookmarked: true }} />)

            expect(screen.getByTestId('card-bookmark')).toHaveAttribute('aria-pressed', 'true')
        })

        it('replaces the bookmark with the owner actions when given', () => {
            const { rerender } = render(<PlaceCard place={place} />)

            expect(screen.queryByText('remove')).not.toBeInTheDocument()

            rerender(
                <PlaceCard
                    place={place}
                    actions={<button>remove</button>}
                />
            )

            expect(screen.getByRole('button', { name: 'remove' })).toBeInTheDocument()
            expect(screen.queryByTestId('card-bookmark')).not.toBeInTheDocument()
        })

        it('marks a place the visitor has been to', () => {
            const { rerender } = render(<PlaceCard place={place} />)

            expect(screen.queryByText('Вы были здесь')).not.toBeInTheDocument()

            rerender(<PlaceCard place={{ ...place, visited: true }} />)

            expect(screen.getByText('Вы были здесь')).toBeInTheDocument()
        })
    })

    describe('row', () => {
        it('renders the title with the requested heading level and a plain address', () => {
            render(
                <PlaceCard
                    place={place}
                    variant={'row'}
                    headingLevel={3}
                />
            )

            expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Cool Cave')
            expect(screen.getByText('Russia, Moscow Oblast')).toBeInTheDocument()
            expect(screen.getByTestId('category-icon')).toHaveAttribute('data-size', '16')
            expect(screen.queryByText('Caves')).not.toBeInTheDocument()
        })

        it('prefers an explicit distance and label over the API distance', () => {
            render(
                <PlaceCard
                    place={place}
                    variant={'row'}
                    distanceKm={2.4}
                    distanceLabel={'2.4 км от предыдущего'}
                />
            )

            expect(screen.getByText('2.4 км от предыдущего')).toBeInTheDocument()
            expect(screen.queryByText(/1\.2/)).not.toBeInTheDocument()
        })

        it('renders leading, footer and actions slots', () => {
            render(
                <PlaceCard
                    place={place}
                    variant={'row'}
                    size={'small'}
                    leading={<span>#1</span>}
                    footer={<p>note</p>}
                    actions={<button>act</button>}
                />
            )

            expect(screen.getByText('#1')).toBeInTheDocument()
            expect(screen.getByText('note')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'act' })).toBeInTheDocument()
        })

        it('shows the start of the description as plain text after the address', () => {
            const { container } = render(
                <PlaceCard
                    place={{ ...place, content: 'A **deep** cave with an underground lake' }}
                    variant={'row'}
                />
            )

            const excerpt = screen.getByText('A deep cave with an underground lake')
            expect(excerpt.tagName).toBe('P')
            expect(container.textContent?.indexOf('Russia')).toBeLessThan(container.textContent?.indexOf('A deep') ?? 0)
        })

        it('has no description line without a description', () => {
            const { container } = render(
                <PlaceCard
                    place={place}
                    variant={'row'}
                />
            )

            expect(container.querySelector('p')).toBeNull()
        })
    })

    describe('tile description', () => {
        it('is never shown on a tile', () => {
            render(<PlaceCard place={{ ...place, content: 'A deep cave' }} />)

            expect(screen.queryByText('A deep cave')).toBeNull()
        })
    })
})
