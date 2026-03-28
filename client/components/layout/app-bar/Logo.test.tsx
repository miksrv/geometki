import React from 'react'

import { render, screen } from '@testing-library/react'

import { Logo } from './Logo'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

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

const mockUseTheme = jest.fn()

jest.mock('next-themes', () => ({
    useTheme: () => mockUseTheme()
}))

describe('Logo', () => {
    beforeEach(() => {
        mockUseTheme.mockReturnValue({ theme: 'light' })
    })

    describe('rendering', () => {
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

    describe('theme', () => {
        it('applies dark class when theme is dark', () => {
            mockUseTheme.mockReturnValue({ theme: 'dark' })
            render(<Logo />)
            expect(screen.getByRole('link')).toHaveClass('dark')
        })

        it('does not apply dark class when theme is light', () => {
            mockUseTheme.mockReturnValue({ theme: 'light' })
            render(<Logo />)
            expect(screen.getByRole('link')).not.toHaveClass('dark')
        })
    })
})
