import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { HomeCollections } from './HomeCollections'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, link }: any) => <a href={link}>{label}</a>,
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/link', () => {
    const Link = ({ href, children }: any) => <a href={href}>{children}</a>
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/components/shared', () => ({
    CollectionCard: ({ collection }: any) => <article>{collection.title}</article>,
    Section: ({ title, action, children }: any) => (
        <section>
            <h2>{title}</h2>
            {action}
            {children}
        </section>
    )
}))

jest.mock('@/components/shared/media-tile', () => ({
    MediaTileGrid: ({ children }: any) => <div>{children}</div>,
    mediaTileStyles: { media: 'media' }
}))

const collection = (id: string): ApiModel.Collection => ({ id, placesCount: 4, title: `Подборка ${id}` }) as any

describe('HomeCollections', () => {
    it('renders nothing without collections', () => {
        const { container } = render(<HomeCollections collections={[]} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('fills a short row with the "make your own" tile', () => {
        render(<HomeCollections collections={[collection('a'), collection('b')]} />)

        expect(screen.getAllByRole('article')).toHaveLength(2)
        expect(screen.getByRole('link', { name: /home-collections-create-title/ })).toHaveAttribute(
            'href',
            '/collections'
        )
    })

    it('shows one full row without the extra tile', () => {
        render(<HomeCollections collections={['a', 'b', 'c', 'd'].map(collection)} />)

        expect(screen.getAllByRole('article')).toHaveLength(3)
        expect(screen.queryByText('home-collections-create-title')).not.toBeInTheDocument()
    })
})
