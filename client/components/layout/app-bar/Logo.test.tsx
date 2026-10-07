import React from 'react'

import { render, screen } from '@testing-library/react'

import { Logo } from './Logo'

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

describe('Logo', () => {
    it('renders a link to the home page', () => {
        render(<Logo />)
        expect(screen.getByRole('link')).toHaveAttribute('href', '/')
    })

    it('renders a link with title Geometki', () => {
        render(<Logo />)
        expect(screen.getByTitle('Geometki')).toBeInTheDocument()
    })

    it('applies the logo class', () => {
        render(<Logo />)
        expect(screen.getByRole('link')).toHaveClass('logo')
    })
})
