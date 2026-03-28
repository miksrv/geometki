import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick, mode }: any) => (
        <button data-icon={icon} data-mode={mode} onClick={onClick} />
    ),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>,
    Checkbox: ({ id, label, checked, indeterminate, onChange }: any) => (
        <label htmlFor={id}>
            <input type={'checkbox'} id={id} name={id} checked={!!checked} onChange={onChange} />
            {id}
        </label>
    )
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => <img src={src} alt={alt} />
    Image.displayName = 'Image'
    return Image
})

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
        useCategoriesGetListQuery: jest.fn().mockReturnValue({
            data: {
                items: [
                    { name: 'abandoned', title: 'Заброшенные' },
                    { name: 'nature', title: 'Природа' }
                ]
            }
        })
    },
    ApiModel: {
        Categories: { abandoned: 'abandoned', nature: 'nature' }
    }
}))

jest.mock('@/features/categories/categories.utils', () => ({
    categoryImage: jest.fn().mockReturnValue({ src: '/icons/category.png' })
}))

import { CategoryControl } from './CategoryControl'

describe('CategoryControl', () => {
    describe('closed state', () => {
        it('renders the Tune button when closed', () => {
            render(<CategoryControl />)
            expect(screen.getByRole('button')).toHaveAttribute('data-icon', 'Tune')
        })

        it('does not show category list when closed', () => {
            render(<CategoryControl />)
            expect(screen.queryByText('Все категории геометок')).not.toBeInTheDocument()
        })
    })

    describe('open state', () => {
        it('opens category list when button is clicked', () => {
            render(<CategoryControl />)
            fireEvent.click(screen.getByRole('button'))
            // The allCategories checkbox should now be visible
            expect(document.querySelector('input#allCategories')).toBeInTheDocument()
        })

        it('renders category items from API', () => {
            render(<CategoryControl />)
            fireEvent.click(screen.getByRole('button'))
            // Checkboxes rendered with id as their label text in our mock
            expect(document.querySelector('input#abandoned')).toBeInTheDocument()
            expect(document.querySelector('input#nature')).toBeInTheDocument()
        })
    })

    describe('callbacks', () => {
        it('calls onChangeCategories when a category checkbox changes', () => {
            const onChangeCategories = jest.fn()
            render(<CategoryControl categories={['abandoned']} onChangeCategories={onChangeCategories} />)
            fireEvent.click(screen.getByRole('button'))
            const checkbox = document.querySelector('input#nature') as HTMLInputElement
            // The handler reads event.target.id, which is already set on the element
            fireEvent.click(checkbox)
            expect(onChangeCategories).toHaveBeenCalled()
        })
    })
})
