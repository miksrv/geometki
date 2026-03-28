import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height }: any) => (
        <img src={src} alt={alt} width={width} height={height} />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('@/utils/helpers', () => ({
    formatDate: (_date: Date | string, format: string) => {
        if (format === 'YYYY') return '2026'
        return '01.01.2026, 00:00'
    }
}))

jest.mock('@/package.json', () => ({ version: '1.5.0' }), { virtual: true })
jest.mock('@/update', () => new Date('2026-01-01'), { virtual: true })

import { Footer } from './Footer'

describe('Footer', () => {
    describe('rendering', () => {
        it('renders a footer element', () => {
            render(<Footer />)
            expect(screen.getByRole('contentinfo')).toBeInTheDocument()
        })

        it('renders the copyright text', () => {
            render(<Footer />)
            expect(screen.getByText(/Copyright/)).toBeInTheDocument()
        })

        it('renders the MikSoft link', () => {
            render(<Footer />)
            expect(screen.getByRole('link', { name: /Mik/ })).toHaveAttribute('href', 'https://miksoft.pro')
        })

        it('renders the current year', () => {
            render(<Footer />)
            // Use getAllByText since the year appears in the copyright text and the update date
            expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0)
        })

        it('renders the version number', () => {
            render(<Footer />)
            expect(screen.getByText('1.5.0')).toBeInTheDocument()
        })

        it('renders the MikSoft favicon image', () => {
            render(<Footer />)
            const img = screen.getByRole('presentation')
            expect(img).toHaveAttribute('src', 'https://miksoft.pro/favicon.ico')
        })
    })
})
