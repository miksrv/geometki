import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { CollectionCard } from './CollectionCard'

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
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
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
    it('renders the title and links to the collection page', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByText('Водопады Краснодарского края')).toBeInTheDocument()
        expect(screen.getByRole('link')).toHaveAttribute('href', '/collections/col-1-vodopady')
    })

    it('renders the title as a level-2 heading (h2)', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Водопады Краснодарского края')
    })

    it('renders the places count', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.getByText('{{count}} мест')).toBeInTheDocument()
    })

    it('does not render a cover image when the collection has none', () => {
        render(<CollectionCard collection={baseCollection} />)

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('renders the cover image when present', () => {
        render(
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

        expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('cover_preview.jpg'))
    })

    it('renders the region and category when set', () => {
        render(
            <CollectionCard
                collection={{
                    ...baseCollection,
                    region: { id: 12, name: 'Краснодарский край' },
                    category: { name: ApiModel.Categories.waterfall, title: 'Водопады' }
                }}
            />
        )

        expect(screen.getByText('Краснодарский край')).toBeInTheDocument()
        expect(screen.getByText('Водопады')).toBeInTheDocument()
    })
})
