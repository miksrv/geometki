import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { CategoryControl } from './CategoryControl'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick, mode, 'aria-label': ariaLabel }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            aria-label={ariaLabel}
            onClick={onClick}
        />
    ),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Checkbox: ({ id, _label, checked, _indeterminate, onChange }: any) => (
        <label htmlFor={id}>
            <input
                type={'checkbox'}
                id={id}
                name={id}
                checked={!!checked}
                onChange={onChange}
            />
            {id}
        </label>
    )
}))

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

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            String(opts?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(opts?.[name] ?? ''))
    })
}))

jest.mock('@/api', () => ({
    ApiModel: {
        Categories: { abandoned: 'abandoned', landscape: 'landscape' }
    }
}))

jest.mock('@/utils/categories', () => ({
    getCategoryOptions: () => [
        { image: { src: '/icons/category.png' }, key: 'abandoned', value: 'Заброшенные' },
        { image: { src: '/icons/category.png' }, key: 'landscape', value: 'Природное чудо' }
    ]
}))

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

    describe('counter of the selected categories', () => {
        it('is hidden when all categories are selected', () => {
            render(<CategoryControl categories={['abandoned', 'landscape'] as any} />)
            expect(screen.queryByText('2')).not.toBeInTheDocument()
        })

        it('shows how many categories are selected when some are off', () => {
            render(<CategoryControl categories={['abandoned'] as any} />)
            expect(screen.getByText('1')).toBeInTheDocument()
        })

        it('shows 0 when every category is off', () => {
            render(<CategoryControl categories={[]} />)
            expect(screen.getByText('0')).toBeInTheDocument()
        })

        it('tells the number of selected categories in the button label', () => {
            render(<CategoryControl categories={['abandoned'] as any} />)
            expect(screen.getByRole('button')).toHaveAccessibleName('Фильтр по категориям: выбрано 1 из 2')
        })

        it('keeps the plain label when nothing is filtered', () => {
            render(<CategoryControl categories={['abandoned', 'landscape'] as any} />)
            expect(screen.getByRole('button')).toHaveAccessibleName('Фильтр по категориям')
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
            expect(document.querySelector('input#landscape')).toBeInTheDocument()
        })
    })

    describe('callbacks', () => {
        it('calls onChangeCategories when a category checkbox changes', () => {
            const onChangeCategories = jest.fn()
            render(
                <CategoryControl
                    categories={['abandoned']}
                    onChangeCategories={onChangeCategories}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            const checkbox = document.querySelector('input#landscape') as HTMLInputElement
            // The handler reads event.target.id, which is already set on the element
            fireEvent.click(checkbox)
            expect(onChangeCategories).toHaveBeenCalled()
        })
    })
})
