import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Search } from './Search'

jest.mock('next/router', () => ({
    useRouter: () => ({
        pathname: '/',
        asPath: '/',
        query: {},
        push: jest.fn().mockResolvedValue(true),
        replace: jest.fn().mockResolvedValue(true)
    })
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
        useSearchSuggestQuery: jest.fn().mockReturnValue({ data: undefined, isFetching: false })
    },
    ApiType: {}
}))

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ onClick, className, icon, ref, ...rest }: any) => (
        <button
            ref={ref}
            className={className}
            data-icon={icon}
            aria-label={rest['aria-label']}
            onClick={onClick}
        />
    )
}))

jest.mock('@/components/ui', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Autocomplete: ({ placeholder, className, autoFocus }: any) => (
        <input
            data-testid={'autocomplete'}
            placeholder={placeholder}
            className={className}
            data-autofocus={autoFocus ? 'true' : 'false'}
        />
    ),
    AutocompleteOption: {}
}))

describe('Search', () => {
    describe('rendering', () => {
        it('renders the autocomplete input', () => {
            render(<Search />)
            expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
        })

        it('renders with the correct placeholder text', () => {
            render(<Search />)
            expect(screen.getByPlaceholderText('Поиск мест, координат')).toBeInTheDocument()
        })

        it('renders the compact search button for narrow screens', () => {
            render(<Search />)
            expect(screen.getByRole('button', { name: 'Поиск мест, координат' })).toBeInTheDocument()
        })

        it('does not render the overlay field until opened', () => {
            render(<Search />)
            expect(screen.getAllByTestId('autocomplete')).toHaveLength(1)
        })
    })

    describe('mobile overlay', () => {
        it('opens the overlay with a focused field and closes it again', () => {
            render(<Search />)

            fireEvent.click(screen.getByRole('button', { name: 'Поиск мест, координат' }))
            const fields = screen.getAllByTestId('autocomplete')
            expect(fields).toHaveLength(2)
            expect(fields[1]).toHaveAttribute('data-autofocus', 'true')

            fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
            expect(screen.getAllByTestId('autocomplete')).toHaveLength(1)
        })

        it('closes the overlay on Escape', () => {
            render(<Search />)

            fireEvent.click(screen.getByRole('button', { name: 'Поиск мест, координат' }))
            expect(screen.getAllByTestId('autocomplete')).toHaveLength(2)

            fireEvent.keyDown(document, { key: 'Escape' })
            expect(screen.getAllByTestId('autocomplete')).toHaveLength(1)
        })

        it('returns focus to the trigger button when the overlay closes', () => {
            render(<Search />)

            const triggerButton = screen.getByRole('button', { name: 'Поиск мест, координат' })
            fireEvent.click(triggerButton)

            fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
            expect(triggerButton).toHaveFocus()
        })
    })
})
