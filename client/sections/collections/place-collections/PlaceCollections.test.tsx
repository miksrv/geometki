import React from 'react'

import { render, screen } from '@testing-library/react'

import { API } from '@/api'

import { PlaceCollections } from './PlaceCollections'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ title, children }: any) => (
        <section>
            <h3>{title}</h3>
            {children}
        </section>
    ),
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
    const Link = ({ href, children, title, className }: any) => (
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
        t: (key: string, opts?: Record<string, unknown>) => {
            const value = (opts?.defaultValue as string) ?? key
            return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) => String(opts?.[name] ?? ''))
        }
    })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

jest.mock('@/api', () => ({
    API: { useCollectionsGetListQuery: jest.fn() }
}))

const useList = jest.mocked(API.useCollectionsGetListQuery)

describe('PlaceCollections', () => {
    it('renders nothing while the place is in no collection', () => {
        useList.mockReturnValue({ data: { items: [], count: 0 } } as any)

        const { container } = render(<PlaceCollections placeId={'p1'} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('lists the collections as compact rows with the total in the title', () => {
        useList.mockReturnValue({
            data: {
                count: 7,
                items: [
                    {
                        id: 'c1',
                        slug: 'lakes',
                        title: 'Озёра',
                        placesCount: 12,
                        author: { id: 'u1', name: 'Лена' },
                        cover: { preview: 'uploads/p1/cover_preview.jpg' }
                    },
                    { id: 'c2', slug: null, title: 'Без обложки', placesCount: 3, author: { id: 'u2', name: 'Миша' } }
                ]
            }
        } as any)

        const { container } = render(<PlaceCollections placeId={'p1'} />)

        expect(screen.getByRole('heading')).toHaveTextContent('В коллекциях (7)')
        expect(screen.getByRole('link', { name: /Озёра/ })).toHaveAttribute('href', '/collections/c1-lakes')
        expect(screen.getByText('12 мест · Лена')).toBeInTheDocument()
        // Covers are decorative (alt=""), the row link carries the title
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/uploads/p1/cover_preview.jpg')
        expect(screen.getByTestId('icon-Layers')).toBeInTheDocument()
    })
})
