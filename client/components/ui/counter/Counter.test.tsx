import React from 'react'
import { render, screen } from '@testing-library/react'

import { Counter } from './Counter'

describe('Counter', () => {
    describe('rendering', () => {
        it('renders the value when a positive number is given', () => {
            render(<Counter value={7} />)
            expect(screen.getByText('7')).toBeInTheDocument()
        })

        it('renders nothing when value is 0 (falsy)', () => {
            const { container } = render(<Counter value={0} />)
            expect(container.firstChild).toBeNull()
        })

        it('renders nothing when value is undefined', () => {
            const { container } = render(<Counter />)
            expect(container.firstChild).toBeNull()
        })

        it('renders negative values', () => {
            render(<Counter value={-3} />)
            // -3 is falsy? No, -3 is truthy in JS
            expect(screen.getByText('-3')).toBeInTheDocument()
        })
    })

    describe('className prop', () => {
        it('applies custom className when provided', () => {
            const { container } = render(<Counter value={5} className={'my-custom'} />)
            expect(container.firstChild).toHaveClass('my-custom')
        })
    })
})
