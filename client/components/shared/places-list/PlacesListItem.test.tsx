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

jest.mock('@/features/categories/categories.utils', () => ({
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
    removeMarkdown: jest.fn((s: string) => s)
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

        it('renders the place content', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            expect(screen.getByText('A fascinating place to visit.')).toBeInTheDocument()
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

        it('renders the category icon', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            const categoryImg = document.querySelector('img.categoryIcon')
            expect(categoryImg).toBeInTheDocument()
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
        it('renders rating PlacePlate when rating is present', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            const plates = screen.getAllByTestId('place-plate')
            const ratingPlate = plates.find((p) => p.getAttribute('data-icon') === 'StarEmpty')
            expect(ratingPlate).toBeInTheDocument()
        })

        it('does not render rating PlacePlate when rating is 0', () => {
            const placeWithoutRating = { ...mockPlace, rating: 0 }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeWithoutRating}
                />
            )
            const plates = screen.queryAllByTestId('place-plate')
            const ratingPlate = plates.find((p) => p.getAttribute('data-icon') === 'StarEmpty')
            expect(ratingPlate).toBeUndefined()
        })
    })

    describe('distance', () => {
        it('renders distance PlacePlate when distance is present', () => {
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={mockPlace}
                />
            )
            const plates = screen.getAllByTestId('place-plate')
            const distancePlate = plates.find((p) => p.getAttribute('data-icon') === 'Ruler')
            expect(distancePlate).toBeInTheDocument()
        })

        it('does not render distance PlacePlate when distance is 0', () => {
            const placeWithoutDistance = { ...mockPlace, distance: 0 }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeWithoutDistance}
                />
            )
            const plates = screen.queryAllByTestId('place-plate')
            const distancePlate = plates.find((p) => p.getAttribute('data-icon') === 'Ruler')
            expect(distancePlate).toBeUndefined()
        })
    })

    describe('empty content', () => {
        it('renders empty content message when content is empty', () => {
            const placeNoContent = { ...mockPlace, content: '' }
            render(
                <PlacesListItem
                    t={mockT as any}
                    place={placeNoContent}
                />
            )
            expect(screen.getByText('description-not-added-yet')).toBeInTheDocument()
        })
    })
})
