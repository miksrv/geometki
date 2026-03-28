import React from 'react'
import { render, screen } from '@testing-library/react'

import { Reputation } from './Reputation'

describe('Reputation', () => {
    describe('rendering', () => {
        it('renders the reputation value', () => {
            render(<Reputation value={42} />)
            expect(screen.getByText('42')).toBeInTheDocument()
        })

        it('renders zero value', () => {
            render(<Reputation value={0} />)
            expect(screen.getByText('0')).toBeInTheDocument()
        })

        it('renders negative value', () => {
            render(<Reputation value={-5} />)
            expect(screen.getByText('-5')).toBeInTheDocument()
        })
    })

    describe('color classes', () => {
        it('applies green style for positive values', () => {
            const { container } = render(<Reputation value={10} />)
            // The CSS module class name will be identity-obj-proxy'd as "green" in tests
            expect(container.firstChild).toHaveClass('green')
        })

        it('applies red style for negative values', () => {
            const { container } = render(<Reputation value={-1} />)
            expect(container.firstChild).toHaveClass('red')
        })

        it('does not apply green or red for zero', () => {
            const { container } = render(<Reputation value={0} />)
            expect(container.firstChild).not.toHaveClass('green')
            expect(container.firstChild).not.toHaveClass('red')
        })
    })
})
