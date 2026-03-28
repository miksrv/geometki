import React from 'react'
import { render, screen } from '@testing-library/react'

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
        useLocationGetGeoSearchMutation: jest.fn().mockReturnValue([jest.fn(), { data: undefined, isLoading: false }]),
        usePlacesGetListQuery: jest.fn().mockReturnValue({ data: undefined, isFetching: false })
    },
    ApiType: {}
}))

jest.mock('@/components/ui', () => ({
    Autocomplete: ({ placeholder, className }: any) => (
        <input
            data-testid={'autocomplete'}
            placeholder={placeholder}
            className={className}
        />
    ),
    AutocompleteOption: {}
}))

jest.mock('@/features/categories/categories.utils', () => ({
    categoryImage: jest.fn().mockReturnValue({ src: '/category-icon.png' })
}))

jest.mock('@/utils/coordinates', () => ({
    normalizeInput: jest.fn().mockReturnValue(''),
    isCoordinates: jest.fn().mockReturnValue(false),
    CoordinatesD: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDM: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDMS: { fromString: jest.fn().mockReturnValue({ error: true }) },
    CoordinatesDSigned: { fromString: jest.fn().mockReturnValue({ error: true }) }
}))

import { Search } from './Search'

describe('Search', () => {
    describe('rendering', () => {
        it('renders the autocomplete input', () => {
            render(<Search />)
            expect(screen.getByTestId('autocomplete')).toBeInTheDocument()
        })

        it('renders with the correct placeholder text', () => {
            render(<Search />)
            expect(screen.getByPlaceholderText('Поиск по сайту')).toBeInTheDocument()
        })
    })
})
