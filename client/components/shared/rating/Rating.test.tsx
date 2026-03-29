import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Rating } from './Rating'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

describe('Rating', () => {
    describe('rendering', () => {
        it('renders 5 star list items', () => {
            render(<Rating />)
            expect(screen.getAllByRole('radio')).toHaveLength(5)
        })

        it('renders filled stars up to the current value', () => {
            render(<Rating value={3} />)
            const filledStars = screen.getAllByTestId('icon-StarFilled')
            expect(filledStars).toHaveLength(3)
        })

        it('renders empty stars for stars above the current value', () => {
            render(<Rating value={3} />)
            const emptyStars = screen.getAllByTestId('icon-StarEmpty')
            expect(emptyStars).toHaveLength(2)
        })

        it('renders all empty stars when no value is provided', () => {
            render(<Rating />)
            expect(screen.getAllByTestId('icon-StarEmpty')).toHaveLength(5)
        })
    })

    describe('interaction', () => {
        it('calls onChange with the clicked star rating via label click', () => {
            const onChange = jest.fn()
            render(<Rating onChange={onChange} />)
            // Click the label wrapping the 3rd radio (index 2) to trigger onChange
            const labels = document.querySelectorAll('label')
            fireEvent.click(labels[2])
            expect(onChange).toHaveBeenCalledWith(3)
        })

        it('does not call onChange when disabled', () => {
            const onChange = jest.fn()
            render(
                <Rating
                    onChange={onChange}
                    disabled
                />
            )
            const radios = screen.getAllByRole('radio')
            fireEvent.change(radios[0], { target: { value: 1 } })
            expect(onChange).not.toHaveBeenCalled()
        })

        it('calls onChange on Enter key press', () => {
            const onChange = jest.fn()
            render(<Rating onChange={onChange} />)
            const radios = screen.getAllByRole('radio')
            fireEvent.keyDown(radios[1], { key: 'Enter' })
            expect(onChange).toHaveBeenCalledWith(2)
        })

        it('calls onChange on Space key press', () => {
            const onChange = jest.fn()
            render(<Rating onChange={onChange} />)
            const radios = screen.getAllByRole('radio')
            fireEvent.keyDown(radios[0], { key: ' ' })
            expect(onChange).toHaveBeenCalledWith(1)
        })
    })

    describe('hover state', () => {
        it('shows filled stars on mouse enter', () => {
            render(<Rating value={1} />)
            const listItems = screen.getAllByRole('listitem')
            // Hover the 4th star
            fireEvent.mouseEnter(listItems[3])
            // Should now show 4 filled stars
            expect(screen.getAllByTestId('icon-StarFilled')).toHaveLength(4)
        })

        it('resets to original value on mouse leave', () => {
            render(<Rating value={1} />)
            const listItems = screen.getAllByRole('listitem')
            fireEvent.mouseEnter(listItems[3])
            fireEvent.mouseLeave(listItems[3])
            // Back to original 1 filled star
            expect(screen.getAllByTestId('icon-StarFilled')).toHaveLength(1)
        })

        it('does not change on hover when disabled', () => {
            render(
                <Rating
                    value={1}
                    disabled
                />
            )
            const listItems = screen.getAllByRole('listitem')
            fireEvent.mouseEnter(listItems[4])
            // Still only 1 filled star because disabled prevents hover change
            expect(screen.getAllByTestId('icon-StarFilled')).toHaveLength(1)
        })
    })

    describe('voted state', () => {
        it('applies voted class to list items when voted is true', () => {
            render(
                <Rating
                    value={3}
                    voted
                />
            )
            const listItems = screen.getAllByRole('listitem')
            listItems.forEach((item) => expect(item).toHaveClass('voted'))
        })
    })
})
