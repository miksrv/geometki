import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { CollectionCard } from './CollectionCard'

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
    const Link = ({ href, title, className, children }: any) => (
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
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.test/'
}))

jest.mock('@/utils/helpers', () => ({
    buildCollectionUrl: jest.requireActual('@/utils/collection').buildCollectionUrl,
    numberFormatter: jest.fn((value: number) => String(value)),
    timeAgo: jest.fn().mockReturnValue('2 часа назад')
}))

jest.mock('@/components/shared/user-avatar', () => ({
    UserAvatar: ({ user, caption }: any) => (
        <div data-testid={'user-avatar'}>
            {user?.name} {caption}
        </div>
    )
}))

const baseCollection: ApiModel.Collection = {
    id: 'col-1',
    slug: 'vodopady',
    title: 'Водопады Краснодарского края',
    author: { id: 'u1', name: 'Alice' },
    placesCount: 7,
    views: 120,
    saves: 0,
    featured: false,
    updated: { date: '2026-10-06T12:34:56+00:00', timezone_type: 3, timezone: 'UTC' },
    created: { date: '2026-10-01T09:00:00+00:00', timezone_type: 3, timezone: 'UTC' }
}

describe('CollectionCard', () => {
    it('links the cover and the title to the collection page', () => {
        render(<CollectionCard collection={baseCollection} />)

        const links = screen.getAllByRole('link', { name: 'Водопады Краснодарского края' })

        expect(links).toHaveLength(2)
        links.forEach((link) => expect(link).toHaveAttribute('href', '/collections/col-1-vodopady'))
    })

    it('renders the title as a level-2 heading (h2)', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Водопады Краснодарского края')
    })

    it('renders the author with the last update time', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByTestId('user-avatar')).toHaveTextContent('Alice 2 часа назад')
    })

    it('renders the places count and views', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByText('{{count}} мест')).toBeInTheDocument()
        expect(screen.getByText('120')).toBeInTheDocument()
    })

    it('hides the views counter when there are none', () => {
        render(<CollectionCard collection={{ ...baseCollection, views: 0 }} />)

        expect(screen.queryByTestId('icon-Eye')).not.toBeInTheDocument()
    })

    it('does not render a cover image when the collection has none', () => {
        const { container } = render(<CollectionCard collection={baseCollection} />)

        expect(container.querySelector('img')).not.toBeInTheDocument()
    })

    it("renders a mosaic of the first places' covers", () => {
        const { container } = render(
            <CollectionCard
                collection={{
                    ...baseCollection,
                    covers: [
                        { preview: 'uploads/p1/cover_preview.jpg' },
                        { preview: 'uploads/p2/cover_preview.jpg' },
                        { preview: 'uploads/p3/cover_preview.jpg' }
                    ]
                }}
            />
        )

        const images = container.querySelectorAll('img')

        expect(images).toHaveLength(3)
        expect(images[0]).toHaveAttribute('src', 'https://img.test/uploads/p1/cover_preview.jpg')
        expect(images[2]).toHaveAttribute('src', 'https://img.test/uploads/p3/cover_preview.jpg')
        expect(container.querySelector('[data-count="3"]')).toBeInTheDocument()
    })

    it('falls back to the single cover when the response has no covers list', () => {
        const { container } = render(
            <CollectionCard
                collection={{
                    ...baseCollection,
                    cover: {
                        full: 'uploads/collections/col-1/cover.jpg',
                        preview: 'uploads/collections/col-1/cover_preview.jpg'
                    }
                }}
            />
        )

        // Mosaic images are decorative (alt=""), the link carries the title
        const images = container.querySelectorAll('img')

        expect(images).toHaveLength(1)
        expect(images[0]).toHaveAttribute('src', 'https://img.test/uploads/collections/col-1/cover_preview.jpg')
    })

    it('renders the region as a filter link when set', () => {
        render(
            <CollectionCard
                collection={{
                    ...baseCollection,
                    region: { id: 12, name: 'Краснодарский край' }
                }}
            />
        )

        expect(screen.getByRole('link', { name: /Краснодарский край/ })).toHaveAttribute(
            'href',
            '/collections?region=12'
        )
    })

    it('renders no region link when the region is missing', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.queryByRole('link', { name: /Все коллекции в регионе/ })).not.toBeInTheDocument()
    })
})
