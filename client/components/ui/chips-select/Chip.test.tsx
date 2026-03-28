import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

import { Chip } from './Chip'

describe('Chip', () => {
    describe('rendering', () => {
        it('renders the chip text', () => {
            render(<Chip text={'React'} />)
            expect(screen.getByText('React')).toBeInTheDocument()
        })

        it('renders a close button', () => {
            render(<Chip text={'React'} />)
            expect(screen.getByRole('button')).toBeInTheDocument()
        })

        it('renders the Close icon inside the button', () => {
            render(<Chip text={'React'} />)
            expect(screen.getByTestId('icon-Close')).toBeInTheDocument()
        })
    })

    describe('interaction', () => {
        it('calls onClickRemove with the chip text when the close button is clicked', () => {
            const onRemove = jest.fn()
            render(<Chip text={'React'} onClickRemove={onRemove} />)
            fireEvent.click(screen.getByRole('button'))
            expect(onRemove).toHaveBeenCalledWith('React')
        })

        it('does not throw when onClickRemove is not provided', () => {
            render(<Chip text={'React'} />)
            expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
        })
    })
})
