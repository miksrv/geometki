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
    buildPlaceUrl: jest.requireActual('@/utils/place').buildPlaceUrl,
    dateToUnixTime: jest.fn().mockReturnValue(1700000000),
    numberFormatter: jest.fn((value: number) => String(value))
}))

jest.mock('@/components/shared/category-badge', () => ({
    CategoryBadge: ({ category }: any) => <div data-testid={'category-badge'}>{category?.title}</div>
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
    category: { name: 'cave' as ApiModel.Categories, title: 'Caves' },
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

        it('renders the cover with a cache-busting key', () => {
            render(<PlaceCard place={place} />)

            expect(screen.getByRole('img')).toHaveAttribute(
                'src',
                'https://img.test/covers/p1-preview.jpg?d=1700000000'
            )
        })

        it('shows neither who added the place nor when', () => {
            const { container } = render(<PlaceCard place={place} />)

            expect(container.querySelectorAll('article > div')).toHaveLength(1)
            expect(screen.queryByText(/2026/)).not.toBeInTheDocument()
        })

        it('renders the category badge, address links and stats in the fixed order', () => {
            render(<PlaceCard place={place} />)

            expect(screen.getByTestId('category-badge')).toHaveTextContent('Caves')
            expect(screen.getByRole('link', { name: /Russia/ })).toHaveAttribute('href', '/places?country=ru')

            const icons = screen.getAllByTestId(/^icon-/).map((icon) => icon.getAttribute('data-testid'))
            expect(icons).toStrictEqual(['icon-StarEmpty', 'icon-Ruler', 'icon-Eye', 'icon-Camera'])
            expect(screen.getByText('4.5')).toBeInTheDocument()
            expect(screen.getByText(/1\.2/)).toBeInTheDocument()
        })

        it('hides zero stats', () => {
            render(<PlaceCard place={{ ...place, rating: 0, distance: 0, views: 0, photos: 0 }} />)

            expect(screen.queryAllByTestId(/^icon-/)).toHaveLength(0)
        })

        it('still renders an article without cover, category or address', () => {
            render(<PlaceCard place={{ id: 'p2', title: 'Bare', lat: 1, lon: 1 }} />)

            expect(screen.getByRole('article')).toBeInTheDocument()
            expect(screen.queryByRole('img')).not.toBeInTheDocument()
            expect(screen.queryByTestId('category-badge')).not.toBeInTheDocument()
        })

        it('renders actions over the cover only when given', () => {
            const { rerender } = render(<PlaceCard place={place} />)

            expect(screen.queryByText('remove')).not.toBeInTheDocument()

            rerender(
                <PlaceCard
                    place={place}
                    actions={<button>remove</button>}
                />
            )

            expect(screen.getByRole('button', { name: 'remove' })).toBeInTheDocument()
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
            expect(screen.getByTestId('category-badge')).toBeInTheDocument()
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
    })
})
