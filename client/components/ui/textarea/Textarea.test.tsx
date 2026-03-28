import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Textarea } from './Textarea'

describe('Textarea', () => {
    describe('rendering', () => {
        it('renders a textarea element', () => {
            render(<Textarea />)
            expect(screen.getByRole('textbox')).toBeInTheDocument()
        })

        it('renders a label when provided', () => {
            render(<Textarea label={'Description'} />)
            expect(screen.getByText('Description')).toBeInTheDocument()
        })

        it('does not render a label element when label is not provided', () => {
            render(<Textarea />)
            expect(screen.queryByRole('label')).not.toBeInTheDocument()
        })

        it('passes through standard HTML textarea attributes', () => {
            render(
                <Textarea
                    placeholder={'Enter text...'}
                    value={''}
                    onChange={() => {}}
                />
            )
            expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter text...')
        })
    })

    describe('onChange', () => {
        it('calls the onChange prop with the new value', () => {
            const handleChange = jest.fn()
            render(<Textarea onChange={handleChange} />)
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } })
            expect(handleChange).toHaveBeenCalledWith('Hello')
        })

        it('does not throw when onChange is not provided', () => {
            render(<Textarea />)
            expect(() => fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })).not.toThrow()
        })
    })

    describe('rows', () => {
        it('defaults to rows=1', () => {
            render(<Textarea />)
            expect(screen.getByRole('textbox')).toHaveAttribute('rows', '1')
        })
    })
})
