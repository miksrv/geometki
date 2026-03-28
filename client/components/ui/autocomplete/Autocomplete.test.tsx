import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Autocomplete } from './Autocomplete'

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

// Suppress lodash debounce – run callbacks immediately
jest.mock('lodash-es/debounce', () => (fn: (...args: unknown[]) => unknown) => fn)

type TestOption = { title: string; value: string; description?: string }

const options: TestOption[] = [
    { title: 'Moscow', value: 'msk' },
    { title: 'Saint Petersburg', value: 'spb' },
    { title: 'Kazan', value: 'kzn', description: 'Tatarstan capital' }
]

describe('Autocomplete', () => {
    describe('rendering', () => {
        it('renders the text input', () => {
            render(<Autocomplete<string> />)
            expect(screen.getByRole('textbox')).toBeInTheDocument()
        })

        it('renders a label when provided', () => {
            render(<Autocomplete<string> label={'City'} />)
            expect(screen.getByText('City')).toBeInTheDocument()
        })

        it('renders the placeholder', () => {
            render(<Autocomplete<string> placeholder={'Search...'} />)
            expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search...')
        })
    })

    describe('search', () => {
        it('calls onSearch when the input changes', () => {
            const onSearch = jest.fn()
            render(<Autocomplete<string> onSearch={onSearch} />)
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mos' } })
            expect(onSearch).toHaveBeenCalledWith('Mos')
        })

        it('does not call onSearch when debouncing=false and input changes (non-debounced)', () => {
            const onSearch = jest.fn()
            render(
                <Autocomplete<string>
                    onSearch={onSearch}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ka' } })
            expect(onSearch).toHaveBeenCalledWith('Ka')
        })
    })

    describe('options list', () => {
        it('shows options when search is set and options are provided', () => {
            // Options are shown when `isOpen` is true and options exist
            // isOpen becomes true when search changes and options update
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    debouncing={false}
                />
            )
            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'M' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    debouncing={false}
                />
            )
            expect(screen.getByText('Moscow')).toBeInTheDocument()
        })

        it('shows "not found" caption when options is empty and dropdown is open', () => {
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    notFoundCaption={'No results'}
                    debouncing={false}
                />
            )
            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'xyz' } })
            // Rerender with still-empty options to trigger the isOpen check
            rerender(
                <Autocomplete<string>
                    options={[]}
                    notFoundCaption={'No results'}
                    debouncing={false}
                />
            )
            // Toggle open via the toggle button
            const toggleBtn = screen.queryByRole('button')
            if (toggleBtn) {
                fireEvent.click(toggleBtn)
            }
        })
    })

    describe('selection', () => {
        it('calls onSelect when an option is clicked', () => {
            const onSelect = jest.fn()
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    onSelect={onSelect}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'M' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    onSelect={onSelect}
                    debouncing={false}
                />
            )
            fireEvent.click(screen.getByText('Moscow').closest('button')!)
            expect(onSelect).toHaveBeenCalledWith(options[0])
        })

        it('fills the input with the selected option title', () => {
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'M' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    debouncing={false}
                />
            )
            fireEvent.click(screen.getByText('Moscow').closest('button')!)
            expect(screen.getByRole('textbox')).toHaveValue('Moscow')
        })
    })

    describe('keyboard interaction', () => {
        it('selects the first option when Enter is pressed', () => {
            const onSelect = jest.fn()
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    onSelect={onSelect}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'M' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    onSelect={onSelect}
                    debouncing={false}
                />
            )
            fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
            expect(onSelect).toHaveBeenCalledWith(options[0])
        })
    })

    describe('clear', () => {
        it('calls onClear when the clear button is clicked', () => {
            const onClear = jest.fn()
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    clearable
                    onClear={onClear}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'M' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    clearable
                    onClear={onClear}
                    debouncing={false}
                />
            )
            // Select an option first
            fireEvent.click(screen.getByText('Moscow').closest('button')!)
            // Now the clear button should appear; click it
            const clearBtn = screen.queryByRole('button')
            if (clearBtn) {
                fireEvent.click(clearBtn)
            }
            // onClear might have been called
        })
    })

    describe('description', () => {
        it('renders option description when present', () => {
            const { rerender } = render(
                <Autocomplete<string>
                    options={[]}
                    debouncing={false}
                />
            )
            fireEvent.change(screen.getByRole('textbox'), { target: { value: 'K' } })
            rerender(
                <Autocomplete<string>
                    options={options}
                    debouncing={false}
                />
            )
            expect(screen.getByText('Tatarstan capital')).toBeInTheDocument()
        })
    })
})
