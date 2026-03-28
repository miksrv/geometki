import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next/image
jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => <img src={src} alt={alt} />
    Image.displayName = 'Image'
    return Image
})

// Mock simple-react-ui-kit
jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

import { DropdownOptionsList } from './DropdownOptionsList'

const options = [
    { key: 'opt1', value: 'Option 1' },
    { key: 'opt2', value: 'Option 2' },
    { key: 'opt3', value: 'Option 3', disabled: true }
]

describe('DropdownOptionsList', () => {
    describe('rendering', () => {
        it('renders all options', () => {
            render(<DropdownOptionsList options={options} />)
            expect(screen.getByText('Option 1')).toBeInTheDocument()
            expect(screen.getByText('Option 2')).toBeInTheDocument()
            expect(screen.getByText('Option 3')).toBeInTheDocument()
        })

        it('renders an empty list when options is undefined', () => {
            const { container } = render(<DropdownOptionsList />)
            const listItems = container.querySelectorAll('li')
            expect(listItems.length).toBe(0)
        })

        it('marks the selected option with active class', () => {
            const selected = options[0]
            const { container } = render(<DropdownOptionsList options={options} selectedOption={selected} />)
            const listItems = container.querySelectorAll('li')
            expect(listItems[0]).toHaveClass('active')
            expect(listItems[1]).not.toHaveClass('active')
        })

        it('marks disabled options with disabled class', () => {
            const { container } = render(<DropdownOptionsList options={options} />)
            const listItems = container.querySelectorAll('li')
            expect(listItems[2]).toHaveClass('disabled')
        })
    })

    describe('interaction', () => {
        it('calls onSelect when a non-disabled option button is clicked', () => {
            const onSelect = jest.fn()
            render(<DropdownOptionsList options={options} onSelect={onSelect} />)
            fireEvent.click(screen.getByText('Option 1').closest('button')!)
            expect(onSelect).toHaveBeenCalledWith(options[0])
        })

        it('does not call onSelect when a disabled option is clicked', () => {
            const onSelect = jest.fn()
            render(<DropdownOptionsList options={options} onSelect={onSelect} />)
            fireEvent.click(screen.getByText('Option 3').closest('button')!)
            expect(onSelect).not.toHaveBeenCalled()
        })
    })
})
