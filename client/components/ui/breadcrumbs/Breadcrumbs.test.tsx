import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock next/link to render a simple anchor
jest.mock('next/link', () => {
    const Link = ({ href, children, title }: any) => (
        <a href={href} title={title}>
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

import { Breadcrumbs } from './Breadcrumbs'

describe('Breadcrumbs', () => {
    describe('rendering', () => {
        it('renders the nav list element', () => {
            const { container } = render(<Breadcrumbs />)
            expect(container.querySelector('ul')).toBeInTheDocument()
        })

        it('renders homePageTitle as a link when provided', () => {
            render(<Breadcrumbs homePageTitle={'Home'} />)
            expect(screen.getByText('Home')).toBeInTheDocument()
            expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
        })

        it('does not render home link when homePageTitle is empty', () => {
            render(<Breadcrumbs homePageTitle={''} />)
            expect(screen.queryByRole('link')).not.toBeInTheDocument()
        })

        it('renders additional links', () => {
            const links = [
                { link: '/places', text: 'Places' },
                { link: '/places/123', text: 'Some Place' }
            ]
            render(<Breadcrumbs links={links} />)
            expect(screen.getByRole('link', { name: 'Places' })).toHaveAttribute('href', '/places')
            expect(screen.getByRole('link', { name: 'Some Place' })).toHaveAttribute('href', '/places/123')
        })

        it('renders currentPage text without a link', () => {
            render(<Breadcrumbs currentPage={'Current Page'} />)
            expect(screen.getByText('Current Page')).toBeInTheDocument()
            // It should be in a plain li, not an anchor
            const currentItem = screen.getByText('Current Page')
            expect(currentItem.tagName).not.toBe('A')
        })

        it('renders all sections together', () => {
            render(
                <Breadcrumbs
                    homePageTitle={'Home'}
                    links={[{ link: '/places', text: 'Places' }]}
                    currentPage={'Details'}
                />
            )
            expect(screen.getByText('Home')).toBeInTheDocument()
            expect(screen.getByText('Places')).toBeInTheDocument()
            expect(screen.getByText('Details')).toBeInTheDocument()
        })
    })

    describe('accessibility', () => {
        it('has aria-label="breadcrumb" on the list', () => {
            render(<Breadcrumbs />)
            expect(screen.getByRole('list', { name: 'breadcrumb' })).toBeInTheDocument()
        })
    })

    describe('className prop', () => {
        it('applies a custom className', () => {
            const { container } = render(<Breadcrumbs className={'custom-class'} />)
            expect(container.querySelector('ul')).toHaveClass('custom-class')
        })
    })
})
