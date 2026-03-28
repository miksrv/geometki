import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

import { RadioButton } from './RadioButton'

describe('RadioButton', () => {
    describe('rendering', () => {
        it('renders a radio input', () => {
            render(<RadioButton />)
            expect(screen.getByRole('radio')).toBeInTheDocument()
        })

        it('renders a label when label prop is provided', () => {
            render(
                <RadioButton
                    label={'Option A'}
                    id={'opt-a'}
                />
            )
            expect(screen.getByText('Option A')).toBeInTheDocument()
        })

        it('does not render a label element when label is omitted', () => {
            render(<RadioButton id={'opt-a'} />)
            expect(screen.queryByRole('label')).not.toBeInTheDocument()
        })

        it('renders the unchecked icon when unchecked', () => {
            render(<RadioButton checked={false} />)
            expect(screen.getByTestId('icon-RadioButtonUnchecked')).toBeInTheDocument()
        })

        it('renders the checked icon when checked', () => {
            render(
                <RadioButton
                    checked={true}
                    readOnly
                />
            )
            expect(screen.getByTestId('icon-RadioButtonChecked')).toBeInTheDocument()
        })
    })

    describe('disabled prop', () => {
        it('disables the radio input when disabled is true', () => {
            render(<RadioButton disabled />)
            expect(screen.getByRole('radio')).toBeDisabled()
        })

        it('applies disabled class to the wrapper when disabled', () => {
            const { container } = render(<RadioButton disabled />)
            expect(container.firstChild).toHaveClass('disabled')
        })
    })

    describe('checked state', () => {
        it('applies checked class to the form field when checked', () => {
            const { container } = render(
                <RadioButton
                    checked={true}
                    readOnly
                />
            )
            const formField = container.querySelector('.formField')
            expect(formField).toHaveClass('checked')
        })
    })

    describe('label association', () => {
        it('associates label with input via htmlFor/id', () => {
            render(
                <RadioButton
                    label={'Pick me'}
                    id={'pick-me'}
                />
            )
            const label = screen.getByText('Pick me')
            expect(label).toHaveAttribute('for', 'pick-me')
        })
    })
})
