import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlacesListItem } from './PlacesListItem'

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

jest.mock('@/components/shared', () => ({
    PlacePlate: ({ icon, content }: any) => (
        <div
            data-testid={'place-plate'}
            data-icon={icon}
        >
            {content}
        </div>
    )
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/categories', () => ({
    categoryImage: jest.fn().mockReturnValue({ src: '/category-icons/default.png' })
}))

jest.mock('@/utils/address', () => ({
    addressToString: jest.fn().mockReturnValue([
        { type: 'country', id: 'ru', name: 'Russia' },
        { type: 'region', id: 'msk', name: 'Moscow Oblast' }
    ])
}))

jest.mock('@/utils/helpers', () => ({
    addDecimalPoint: jest.fn().mockReturnValue('4.5'),
    dateToUnixTime: jest.fn().mockReturnValue(1700000000),
    numberFormatter: jest.fn().mockReturnValue('1.2'),
    removeMarkdown: jest.fn((s: string) => s),
    timeAgo: jest.fn().mockReturnValue('2 часа назад')
}))

jest.mock('@/components/shared/category-badge', () => ({
    CategoryBadge: ({ category, className }: any) => (
        <div
            data-testid={'category-badge'}
            data-category={category?.name}
            className={className}
        />
    )
}))

jest.mock('@/components/shared/user-avatar', () => ({
    UserAvatar: () => null
}))

const mockT = (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key

const mockPlace: ApiModel.Place = {
    id: 'p1',
    title: 'Cool Cave',
    lat: 55.0,
    lon: 37.0,
    content: 'A fascinating place to visit.',
    rating: 4.5,
    distance: 1.2,
    category: { id: 'c1', name: 'caves', title: 'Caves' },
    cover: { id: 'cov1', preview: '/covers/p1-preview.jpg', full: '/covers/p1-full.jpg' },
    address: {
        country: { id: 'ru', name: 'Russia', type: 'country' }
    }
}

describe('PlacesListItem', () => {
    describe('rendering', () => {
        it('renders an article element', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByRole('article')).toBeInTheDocument()
        })

        it('renders the place title', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getAllByTitle('Cool Cave').length).toBeGreaterThan(0)
        })

        it('renders a link to the place', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            const links = screen.getAllByRole('link')
            const placeLinks = links.filter((l) => (l as HTMLAnchorElement).href.includes('/places/p1'))
            expect(placeLinks.length).toBeGreaterThan(0)
        })

        it('renders the place title in a heading', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Cool Cave')
        })

        it('renders the cover image when cover is provided', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            const images = document.querySelectorAll('img')
            expect(images.length).toBeGreaterThan(0)
        })

        it('renders the category badge when category is provided', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByTestId('category-badge')).toBeInTheDocument()
        })

        it('renders the address links', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByText('Russia')).toBeInTheDocument()
        })
    })

    describe('rating', () => {
        it('renders rating value when rating is present', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByText('4.5')).toBeInTheDocument()
        })

        it('does not render rating value when rating is 0', () => {
            const placeWithoutRating = { ...mockPlace, rating: 0 }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeWithoutRating}
                />
            )
            expect(screen.queryByText('4.5')).not.toBeInTheDocument()
        })
    })

    describe('distance', () => {
        it('renders distance value when distance is present', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByText(/1\.2/)).toBeInTheDocument()
        })

        it('does not render distance value when distance is 0', () => {
            const placeWithoutDistance = { ...mockPlace, distance: 0 }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeWithoutDistance}
                />
            )
            expect(screen.queryByText(/1\.2/)).not.toBeInTheDocument()
        })
    })

    describe('empty content', () => {
        it('still renders article when content is empty', () => {
            const placeNoContent = { ...mockPlace, content: '' }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeNoContent}
                />
            )
            expect(screen.getByRole('article')).toBeInTheDocument()
        })
    })
})
