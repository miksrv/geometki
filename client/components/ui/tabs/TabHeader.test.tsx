import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

import TabHeader from './TabHeader'

describe('TabHeader', () => {
    describe('rendering', () => {
        it('renders the label text', () => {
            render(<TabHeader label={'Overview'} />)
            expect(screen.getByText('Overview')).toBeInTheDocument()
        })

        it('renders a button element', () => {
            render(<TabHeader label={'Tab'} />)
            expect(screen.getByRole('button')).toBeInTheDocument()
        })

        it('has type="button" to avoid accidental form submission', () => {
            render(<TabHeader label={'Tab'} />)
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
        })
    })

    describe('active state', () => {
        it('applies active class when isActive is true', () => {
            render(<TabHeader label={'Active Tab'} isActive />)
            expect(screen.getByRole('button')).toHaveClass('active')
        })

        it('does not apply active class when isActive is false', () => {
            render(<TabHeader label={'Inactive Tab'} isActive={false} />)
            expect(screen.getByRole('button')).not.toHaveClass('active')
        })
    })

    describe('interaction', () => {
        it('calls onClick handler when clicked', () => {
            const handleClick = jest.fn()
            render(<TabHeader label={'Clickable'} onClick={handleClick} />)
            fireEvent.click(screen.getByRole('button'))
            expect(handleClick).toHaveBeenCalledTimes(1)
        })
    })
})
