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

    it('names the collections in one line with the total and the rest', () => {
        useList.mockReturnValue({
            data: {
                count: 5,
                items: [
                    { id: 'c1', slug: 'lakes', title: 'Озёра', placesCount: 12 },
                    { id: 'c2', slug: null, title: 'Урал', placesCount: 3 }
                ]
            }
        } as any)

        const { container } = render(<PlaceCollections placeId={'p1'} />)

        expect(container).toHaveTextContent('В 5 коллекциях: Озёра, Урал и ещё 3')
        expect(screen.getByRole('link', { name: 'Озёра' })).toHaveAttribute('href', '/collections/c1-lakes')
        expect(screen.getByRole('link', { name: 'Урал' })).toHaveAttribute('href', '/collections/c2')
        expect(screen.getByTestId('icon-Layers')).toBeInTheDocument()
    })
})
