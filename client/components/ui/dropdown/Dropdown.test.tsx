import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Dropdown } from './Dropdown'

jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

const options = [
    { key: 'a', value: 'Apple' },
    { key: 'b', value: 'Banana' },
    { key: 'c', value: 'Cherry', disabled: true }
]

describe('Dropdown', () => {
    describe('rendering', () => {
        it('renders the toggle button', () => {
            const { container } = render(<Dropdown options={options} />)
            expect(container.querySelector('button')).toBeInTheDocument()
        })

        it('renders a label when provided', () => {
            render(
                <Dropdown
                    options={options}
                    label={'Fruit'}
                />
            )
            expect(screen.getByText('Fruit')).toBeInTheDocument()
        })

        it('renders the placeholder when no option is selected', () => {
            render(
                <Dropdown
                    options={options}
                    placeholder={'Select one'}
                />
            )
            expect(screen.getByText('Select one')).toBeInTheDocument()
        })

        it('shows error class when error prop is set', () => {
            const { container } = render(
                <Dropdown
                    options={options}
                    error={'Required'}
                />
            )
            expect(container.firstChild).toHaveClass('error')
        })

        it('shows required class when required prop is set', () => {
            const { container } = render(
                <Dropdown
                    options={options}
                    required
                />
            )
            expect(container.firstChild).toHaveClass('required')
        })

        it('shows disabled class when disabled prop is set', () => {
            const { container } = render(
                <Dropdown
                    options={options}
                    disabled
                />
            )
            expect(container.firstChild).toHaveClass('disabled')
        })
    })

    describe('open / close', () => {
        it('opens the options list on button click', () => {
            render(<Dropdown options={options} />)
            // Click the first button (the toggle button)
            fireEvent.click(screen.getAllByRole('button')[0])
            expect(screen.getByText('Apple')).toBeInTheDocument()
        })

        it('closes the options list after selecting an option', () => {
            render(<Dropdown options={options} />)
            fireEvent.click(screen.getAllByRole('button')[0])
            fireEvent.click(screen.getByText('Apple').closest('button')!)
            // The options list should be gone
            expect(screen.queryByText('Banana')).not.toBeInTheDocument()
        })
    })

    describe('selection', () => {
        it('calls onSelect with the chosen option', () => {
            const onSelect = jest.fn()
            render(
                <Dropdown
                    options={options}
                    onSelect={onSelect}
                />
            )
            fireEvent.click(screen.getAllByRole('button')[0])
            fireEvent.click(screen.getByText('Banana').closest('button')!)
            expect(onSelect).toHaveBeenCalledWith(options[1])
        })

        it('does not call onSelect for a disabled option', () => {
            const onSelect = jest.fn()
            render(
                <Dropdown
                    options={options}
                    onSelect={onSelect}
                />
            )
            fireEvent.click(screen.getAllByRole('button')[0])
            fireEvent.click(screen.getByText('Cherry').closest('button')!)
            expect(onSelect).not.toHaveBeenCalled()
        })
    })

    describe('clear', () => {
        it('shows a clear button when clearable and an option is selected via interaction', () => {
            render(
                <Dropdown
                    options={options}
                    clearable
                />
            )
            // Open the dropdown and select an option first
            fireEvent.click(screen.getAllByRole('button')[0])
            fireEvent.click(screen.getByText('Apple').closest('button')!)
            // Now the KeyboardDown icon should be replaced with either KeyboardUp or Close icon
            // The icon-Close should appear in the arrow area
            expect(screen.getByTestId('icon-Close')).toBeInTheDocument()
        })

        it('calls onSelect with the first option when selecting Apple', () => {
            const onSelect = jest.fn()
            render(
                <Dropdown
                    options={options}
                    clearable
                    onSelect={onSelect}
                />
            )
            fireEvent.click(screen.getAllByRole('button')[0])
            fireEvent.click(screen.getByText('Apple').closest('button')!)
            expect(onSelect).toHaveBeenCalledWith(options[0])
        })
    })

    describe('onOpen prop', () => {
        it('calls the onOpen handler instead of toggling internal state', () => {
            const onOpen = jest.fn()
            render(
                <Dropdown
                    options={options}
                    onOpen={onOpen}
                />
            )
            fireEvent.click(screen.getAllByRole('button')[0])
            expect(onOpen).toHaveBeenCalledTimes(1)
            // Since onOpen was called, the options list should not be shown
            expect(screen.queryByText('Apple')).not.toBeInTheDocument()
        })
    })
})
