import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

import { PrevButton, NextButton } from './CarouselButtons'

describe('PrevButton', () => {
    describe('rendering', () => {
        it('renders a button with the KeyboardLeft icon', () => {
            render(<PrevButton />)
            expect(screen.getByRole('button')).toBeInTheDocument()
            expect(screen.getByTestId('icon-KeyboardLeft')).toBeInTheDocument()
        })

        it('renders children when provided', () => {
            render(<PrevButton>Prev</PrevButton>)
            expect(screen.getByText('Prev')).toBeInTheDocument()
        })

        it('is disabled when disabled prop is true', () => {
            render(<PrevButton disabled />)
            expect(screen.getByRole('button')).toBeDisabled()
        })

        it('has type="button" to avoid form submissions', () => {
            render(<PrevButton />)
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
        })
    })

    describe('interaction', () => {
        it('calls onClick when clicked', () => {
            const onClick = jest.fn()
            render(<PrevButton onClick={onClick} />)
            fireEvent.click(screen.getByRole('button'))
            expect(onClick).toHaveBeenCalledTimes(1)
        })

        it('does not call onClick when disabled', () => {
            const onClick = jest.fn()
            render(<PrevButton onClick={onClick} disabled />)
            fireEvent.click(screen.getByRole('button'))
            expect(onClick).not.toHaveBeenCalled()
        })
    })
})

describe('NextButton', () => {
    describe('rendering', () => {
        it('renders a button with the KeyboardRight icon', () => {
            render(<NextButton />)
            expect(screen.getByRole('button')).toBeInTheDocument()
            expect(screen.getByTestId('icon-KeyboardRight')).toBeInTheDocument()
        })

        it('renders children when provided', () => {
            render(<NextButton>Next</NextButton>)
            expect(screen.getByText('Next')).toBeInTheDocument()
        })

        it('is disabled when disabled prop is true', () => {
            render(<NextButton disabled />)
            expect(screen.getByRole('button')).toBeDisabled()
        })

        it('has type="button"', () => {
            render(<NextButton />)
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
        })
    })

    describe('interaction', () => {
        it('calls onClick when clicked', () => {
            const onClick = jest.fn()
            render(<NextButton onClick={onClick} />)
            fireEvent.click(screen.getByRole('button'))
            expect(onClick).toHaveBeenCalledTimes(1)
        })
    })
})
