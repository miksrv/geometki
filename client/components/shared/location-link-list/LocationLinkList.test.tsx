import React from 'react'

import { render, screen } from '@testing-library/react'

import { LocationLinkList } from './LocationLinkList'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ title, children }: any) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

jest.mock('next/link', () => {
    const Link = ({ href, children, className }: any) => (
        <a
            href={href}
            className={className}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

describe('LocationLinkList', () => {
    it('renders nothing without items', () => {
        const { container } = render(
            <LocationLinkList
                title={'Категории'}
                items={[]}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders the title and a link pill per item', () => {
        render(
            <LocationLinkList
                title={'Категории'}
                items={[
                    { href: '/places/bashkortostan/cave', key: 'cave', title: 'Пещеры' },
                    { href: '/places/bashkortostan/mountain', key: 'mountain', title: 'Горы' }
                ]}
            />
        )

        expect(screen.getByRole('heading', { name: 'Категории' })).toBeInTheDocument()

        const caveLink = screen.getByRole('link', { name: 'Пещеры' })
        expect(caveLink).toHaveAttribute('href', '/places/bashkortostan/cave')

        expect(screen.getByRole('link', { name: 'Горы' })).toHaveAttribute('href', '/places/bashkortostan/mountain')
    })

    it('shows the count next to the title when given', () => {
        render(
            <LocationLinkList
                title={'Категории'}
                items={[{ count: 18, href: '/places/bashkortostan/cave', key: 'cave', title: 'Пещеры' }]}
            />
        )

        expect(screen.getByRole('link', { name: 'Пещеры 18' })).toBeInTheDocument()
    })

    it('does not render a count badge when it is undefined', () => {
        render(
            <LocationLinkList
                title={'Категории'}
                items={[{ href: '/places/bashkortostan/cave', key: 'cave', title: 'Пещеры' }]}
            />
        )

        expect(screen.getByRole('link', { name: 'Пещеры' })).toBeInTheDocument()
    })
})
